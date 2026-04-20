import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { ensureProjectChatRooms } from "@/lib/project-chat";
import { getSignedUrl } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  status: z
    .enum(["PENDING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"])
    .optional(),
  price: z.number().positive().optional().nullable(),
  clientId: z.string().optional().nullable(),
  projectDescription: z.string().optional().nullable(),
  teamMemberIds: z.array(z.string()).optional(),
  milestones: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().min(1),
        content: z.string().optional().nullable(),
        status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"]).optional(),
      })
    )
    .optional(),
});

async function canAccess(userId: string, role: string, projectId: string): Promise<boolean> {
  if (["ADMIN", "PROJECT_MANAGER"].includes(role)) return true;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true },
  });
  if (!project) return false;

  if (role === "CLIENT" && project.clientId === userId) return true;

  const membership = await prisma.projectMember.findFirst({
    where: { projectId, userId },
  });
  return !!membership;
}

export const GET = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const id = ctx?.params.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    if (!(await canAccess(userId, role, id))) forbidden();

    const [project, projectDescription, roomMember, unansweredQuestions] = await Promise.all([
      prisma.project.findUnique({
        where: { id },
        include: {
          milestones: { orderBy: { order: "asc" } },
          members: {
            include: {
              user: { select: { id: true, name: true, profilePicUrl: true, role: true } },
            },
          },
          client: { select: { id: true, name: true, profilePicUrl: true } },
          _count: { select: { documents: true, questions: true } },
        },
      }),
      prisma.aIContext.findFirst({
        where: {
          projectId: id,
          taskId: null,
          workspaceId: null,
        },
        select: { content: true },
      }),
      prisma.chatRoomMember.findFirst({
        where: { room: { projectId: id }, userId },
        select: { lastReadAt: true },
      }),
      prisma.projectQuestion.count({
        where: { projectId: id, isApproved: false },
      }),
    ] as const);

    const unreadMessages = await prisma.message.count({
      where: {
        room: { projectId: id },
        senderId: { not: userId },
        ...(roomMember?.lastReadAt ? { createdAt: { gt: roomMember.lastReadAt } } : {}),
      },
    });

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Generate signed URLs and filter out SUPER_ADMIN
    const membersWithSignedUrls = (
      await Promise.all(
        project.members.map(async (m) => {
          if (m.user.role === "SUPER_ADMIN") return null;
          let avatarSignedUrl: string | null = null;
          if (m.user.profilePicUrl) {
            try {
              avatarSignedUrl = await getSignedUrl(m.user.profilePicUrl, 3600);
            } catch {}
          }
          return {
            ...m,
            user: {
              ...m.user,
              profilePicUrl: avatarSignedUrl || m.user.profilePicUrl,
            },
          };
        })
      )
    ).filter((m): m is Exclude<typeof m, null> => m !== null);

    let clientWithSignedUrl = project.client;
    if (project.client?.profilePicUrl) {
      try {
        const url = await getSignedUrl(project.client.profilePicUrl, 3600);
        clientWithSignedUrl = { ...project.client, profilePicUrl: url };
      } catch {}
    }

    return NextResponse.json({
      data: {
        ...project,
        members: membersWithSignedUrls,
        client: clientWithSignedUrl,
        projectDescription: projectDescription?.content ?? "",
        unreadMessages,
        unansweredQuestions,
      },
    });
  }
);

export const PATCH = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    if (!["ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

    const id = ctx?.params.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = (await req.json()) as unknown;
    const parsed = PatchSchema.parse(body);
    const { teamMemberIds, milestones, projectDescription, ...projectData } = parsed;

    const project = await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id },
        data: projectData,
      });

      if (projectDescription !== undefined) {
        const trimmed = projectDescription?.trim() ?? "";
        const existingContext = await tx.aIContext.findFirst({
          where: { projectId: id, taskId: null, workspaceId: null },
          select: { id: true },
        });
        if (existingContext) {
          await tx.aIContext.update({
            where: { id: existingContext.id },
            data: { content: trimmed },
          });
        } else {
          await tx.aIContext.create({
            data: {
              projectId: id,
              taskId: null,
              workspaceId: null,
              content: trimmed,
            },
          });
        }
      }

      // Sync team members if provided
      if (teamMemberIds !== undefined) {
        // Find removed members before deletion (exclude admin/manager — they stay in tasks)
        const existingMembers = await tx.projectMember.findMany({
          where: { projectId: id },
          select: { userId: true, user: { select: { role: true } } },
        });
        const newMemberSet = new Set(teamMemberIds);
        const removedUserIds = existingMembers
          .filter((m) => !newMemberSet.has(m.userId) && !["ADMIN", "PROJECT_MANAGER"].includes(m.user.role))
          .map((m) => m.userId);

        await tx.projectMember.deleteMany({ where: { projectId: id } });
        if (teamMemberIds.length > 0) {
          await tx.projectMember.createMany({
            data: teamMemberIds.map((uid) => ({ projectId: id, userId: uid })),
            skipDuplicates: true,
          });
        }

        // Remove departed members from non-DONE/non-CANCELLED tasks in this project
        if (removedUserIds.length > 0) {
          const activeTasks = await tx.task.findMany({
            where: { projectId: id, status: { notIn: ["DONE", "CANCELLED"] } },
            select: { id: true },
          });
          if (activeTasks.length > 0) {
            await tx.taskAssignee.deleteMany({
              where: {
                taskId: { in: activeTasks.map((t) => t.id) },
                userId: { in: removedUserIds },
              },
            });
          }
        }
      }

      if (milestones !== undefined) {
        const existingMilestones = await tx.milestone.findMany({
          where: { projectId: id },
          select: { id: true },
        });
        const existingIds = new Set(existingMilestones.map((m) => m.id));
        const seenIds = new Set<string>();

        for (let index = 0; index < milestones.length; index++) {
          const incoming = milestones[index];
          const status = incoming.status ?? "NOT_STARTED";
          if (incoming.id && existingIds.has(incoming.id)) {
            seenIds.add(incoming.id);
            await tx.milestone.update({
              where: { id: incoming.id },
              data: {
                title: incoming.title,
                content: incoming.content ?? "",
                order: index,
                status,
                completedAt: status === "COMPLETED" ? new Date() : null,
              },
            });

            const existingDoc = await tx.document.findFirst({
              where: {
                projectId: id,
                milestoneId: incoming.id,
                docType: "milestone_doc",
              },
              select: { id: true },
            });

            if (existingDoc) {
              await tx.document.update({
                where: { id: existingDoc.id },
                data: { title: `${incoming.title} Requirements` },
              });
            } else {
              await tx.document.create({
                data: {
                  projectId: id,
                  milestoneId: incoming.id,
                  title: `${incoming.title} Requirements`,
                  docType: "milestone_doc",
                  access: "INTERNAL",
                  createdById: userId,
                },
              });
            }
          } else {
            const createdMilestone = await tx.milestone.create({
              data: {
                projectId: id,
                title: incoming.title,
                content: incoming.content ?? "",
                order: index,
                status,
                completedAt: status === "COMPLETED" ? new Date() : null,
              },
              select: { id: true },
            });
            seenIds.add(createdMilestone.id);

            await tx.document.create({
              data: {
                projectId: id,
                milestoneId: createdMilestone.id,
                title: `${incoming.title} Requirements`,
                docType: "milestone_doc",
                access: "INTERNAL",
                createdById: userId,
              },
            });
          }
        }

        await tx.document.deleteMany({
          where: {
            projectId: id,
            docType: "milestone_doc",
            milestoneId: { notIn: Array.from(seenIds) },
          },
        });
        await tx.milestone.deleteMany({
          where: { projectId: id, id: { notIn: Array.from(seenIds) } },
        });
      }

      if (teamMemberIds !== undefined || projectData.clientId !== undefined) {
        await ensureProjectChatRooms(tx, id);
      }

      return updated;
    });

    await logAction(userId, "PROJECT_UPDATED", "Project", id);

    return NextResponse.json({ data: project });
  }
);

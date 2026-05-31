import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/db/audit";
import { ensureProjectChatRooms } from "@/lib/chat/project-chat";
import { getSignedUrl } from "@/lib/storage/supabase-storage";
import type { Server } from "socket.io";

declare global {
  var io: Server;
}

export const dynamic = "force-dynamic";

// Extract storage path from either a path or a full Supabase URL
function extractStoragePath(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already a storage path
  if (
    trimmed.startsWith("profile-pics/") ||
    trimmed.startsWith("chat-media/") ||
    trimmed.startsWith("workspace-task-media/") ||
    trimmed.startsWith("photos/") ||
    trimmed.startsWith("cv-files/") ||
    trimmed.startsWith("project-pdfs/") ||
    trimmed.startsWith("receipts/") ||
    trimmed.startsWith("recordings/") ||
    trimmed.startsWith("contracts/")
  ) {
    return trimmed;
  }

  // Extract from Supabase signed URL
  try {
    const url = new URL(trimmed);
    const marker = "/devrolin-files/";
    const idx = url.pathname.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(url.pathname.slice(idx + marker.length)).split("?")[0];
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

// Get signed URL for a profile pic, handling both paths and full URLs
async function getAvatarSignedUrl(profilePicUrl: string | null | undefined): Promise<string | null> {
  const path = extractStoragePath(profilePicUrl);
  if (!path) return profilePicUrl || null;
  try {
    return await getSignedUrl(path, 3600);
  } catch {
    return profilePicUrl || null;
  }
}

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

    const project = await prisma.project.findUnique({
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
      });

      const projectDescription = await prisma.aIContext.findFirst({
        where: {
          projectId: id,
          taskId: null,
          workspaceId: null,
        },
        select: { content: true },
      });

      const roomMember = await prisma.chatRoomMember.findFirst({
        where: { room: { projectId: id }, userId },
        select: { lastReadAt: true },
      });

      // Different counts for clients vs managers
      const isClient = project?.clientId === userId;
      const isManager = ["ADMIN", "PROJECT_MANAGER"].includes(role);

      const [unansweredQuestions, pendingApprovalCount, managers] = await Promise.all([
        // Unanswered = approved questions with no answers
        prisma.projectQuestion.count({
          where: { projectId: id, isApproved: true, answers: { none: {} } },
        }),
        // Pending approval = unapproved questions (all non-client roles)
        !isClient
          ? prisma.projectQuestion.count({
              where: { projectId: id, isApproved: false },
            })
          : Promise.resolve(0),
        // Fetch ADMIN and PROJECT_MANAGER users to show in team list
        prisma.user.findMany({
          where: {
            role: { in: ["ADMIN", "PROJECT_MANAGER"] },
            isActive: true,
          },
          select: { id: true, name: true, profilePicUrl: true, role: true },
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

    // Generate signed URLs and filter out SUPER_ADMIN from regular members
    const membersWithSignedUrls = (
      await Promise.all(
        project.members.map(async (m) => {
          if (m.user.role === "SUPER_ADMIN") return null;
          const avatarSignedUrl = await getAvatarSignedUrl(m.user.profilePicUrl);
          return {
            ...m,
            user: {
              ...m.user,
              profilePicUrl: avatarSignedUrl,
            },
          };
        })
      )
    ).filter((m): m is Exclude<typeof m, null> => m !== null);

    // Process managers with signed URLs
    const managersWithSignedUrls = await Promise.all(
      managers.map(async (u) => {
        const avatarSignedUrl = await getAvatarSignedUrl(u.profilePicUrl);
        return {
          ...u,
          profilePicUrl: avatarSignedUrl,
        };
      })
    );

    let clientWithSignedUrl = project.client;
    if (project.client?.profilePicUrl) {
      const url = await getAvatarSignedUrl(project.client.profilePicUrl);
      clientWithSignedUrl = { ...project.client, profilePicUrl: url };
    }

    return NextResponse.json({
      data: {
        ...project,
        members: membersWithSignedUrls,
        managers: managersWithSignedUrls,
        client: clientWithSignedUrl,
        projectDescription: projectDescription?.content ?? "",
        unreadMessages,
        unansweredQuestions,
        pendingApprovalCount,
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

        // If new milestones were added and project was COMPLETED, revert to ACTIVE
        const hasNewMilestones = milestones.some((m) => !m.id || !existingIds.has(m.id));
        if (hasNewMilestones) {
          const projectStatus = await tx.project.findUnique({
            where: { id },
            select: { status: true },
          });
          if (projectStatus?.status === "COMPLETED") {
            await tx.project.update({
              where: { id },
              data: { status: "ACTIVE" },
            });
          }
        }
      }

      if (teamMemberIds !== undefined || projectData.clientId !== undefined) {
        await ensureProjectChatRooms(tx, id);
      }

      return updated;
    }, {
      maxWait: 10000, // 10s to acquire transaction
      timeout: 60000, // 60s for transaction execution
    });

    // Fetch full project with includes for socket emission
    const fullProject = await prisma.project.findUnique({
      where: { id },
      include: {
        milestones: { orderBy: { order: "asc" } },
        members: {
          include: {
            user: { select: { id: true, name: true, profilePicUrl: true, role: true } },
          },
        },
        client: { select: { id: true, name: true, profilePicUrl: true } },
      },
    });

    // Emit real-time update
    if (global.io && fullProject) {
      global.io.of("/projects").emit("project_updated", { project: fullProject });
    }

    await logAction(userId, "PROJECT_UPDATED", "Project", id);

    return NextResponse.json({ data: fullProject ?? project });
  }
);

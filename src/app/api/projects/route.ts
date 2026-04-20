import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sendNotification } from "@/lib/notify";
import { ensureProjectChatRooms } from "@/lib/project-chat";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  clientId: z.string().optional(),
  requestedById: z.string().optional(),
  requestId: z.string().optional(),
  price: z.number().positive().optional(),
  teamMemberIds: z.array(z.string()).optional(),
  milestones: z
    .array(
      z.object({
        title: z.string().min(1),
        content: z.string().optional(),
        order: z.number(),
      })
    )
    .optional(),
  questions: z
    .array(
      z.object({
        text: z.string().min(1),
        partOf: z.string().optional(),
      })
    )
    .optional(),
});

const PROJECT_INCLUDE = {
  milestones: { orderBy: { order: "asc" as const } },
  members: {
    include: {
      user: { select: { id: true, name: true, profilePicUrl: true, role: true } },
    },
  },
  client: { select: { id: true, name: true, profilePicUrl: true } },
} as const;

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const role = req.headers.get("x-user-role") ?? "";

  if (["ADMIN", "PROJECT_MANAGER"].includes(role)) {
    const projects = await prisma.project.findMany({
      include: PROJECT_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ data: projects });
  }

  if (role === "CLIENT") {
    const projects = await prisma.project.findMany({
      where: { clientId: userId },
      include: PROJECT_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ data: projects });
  }

  // All other roles (DEVELOPER, DESIGNER, HR, ACCOUNTANT, SALES)
  // see only projects they are members of
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  const projects = await prisma.project.findMany({
    where: { id: { in: memberships.map((m) => m.projectId) } },
    include: PROJECT_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ data: projects });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const role = req.headers.get("x-user-role") ?? "";
  if (!["ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

  const body = (await req.json()) as unknown;
  const {
    title,
    description,
    clientId,
    requestedById,
    requestId,
    price,
    teamMemberIds = [],
    milestones = [],
    questions = [],
  } = CreateSchema.parse(body);

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        title,
        clientId: clientId ?? null,
        requestedById: requestedById ?? null,
        createdById: userId,
        price: price ?? null,
      },
    });

    // Persist project description for later display and AI context.
    if (description?.trim()) {
      await tx.aIContext.create({
        data: {
          projectId: p.id,
          taskId: null,
          workspaceId: null,
          content: description.trim(),
        },
      });
    }

    if (teamMemberIds.length > 0) {
      await tx.projectMember.createMany({
        data: teamMemberIds.map((memberId) => ({ projectId: p.id, userId: memberId })),
        skipDuplicates: true,
      });
    }

    if (milestones.length > 0) {
      for (const m of milestones) {
        const createdMilestone = await tx.milestone.create({
          data: {
            projectId: p.id,
            title: m.title,
            content: m.content ?? "",
            order: m.order,
            status: "NOT_STARTED",
          },
        });

        await tx.document.create({
          data: {
            projectId: p.id,
            milestoneId: createdMilestone.id,
            title: `${m.title} Requirements`,
            docType: "milestone_doc",
            access: "INTERNAL",
            createdById: userId,
            initialContent: m.content || null,
          },
        });
      }
    }

    if (questions.length > 0) {
      await tx.projectQuestion.createMany({
        data: questions.map((q) => ({
          projectId: p.id,
          text: q.text,
          partOf: q.partOf ?? "",
          isAiGenerated: true,
          isApproved: false,
          createdById: userId,
        })),
      });
    }

    // Mark the client request as accepted if one was provided
    if (requestId) {
      await tx.clientProjectRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED", projectId: p.id },
      });
    }

    return p;
  });

  // Keep this out of the interactive transaction to avoid timeout (P2028)
  // when manager/member lookups are slow on larger datasets.
  await ensureProjectChatRooms(prisma, project.id);

  await logAction(userId, "PROJECT_CREATED", "Project", project.id);

  // Notify assigned team members
  if (teamMemberIds.length > 0) {
    await Promise.all(
      teamMemberIds.map((memberId) =>
        sendNotification(
          memberId,
          "PROJECT_UPDATE",
          "Added to Project",
          `You have been added to the project **${title}**`,
          `/projects/${project.id}`
        )
      )
    );
  }

  // Notify client if assigned
  if (clientId) {
    await sendNotification(
      clientId,
      "PROJECT_UPDATE",
      "New Project Created",
      `A new project **${title}** has been created for you`,
      `/projects/${project.id}`
    );
  }

  return NextResponse.json({ data: project }, { status: 201 });
});

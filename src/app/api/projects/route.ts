import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/db/audit";
import { sendNotification } from "@/lib/notifications/notify";
import { ensureProjectChatRooms } from "@/lib/chat/project-chat";
import { getSignedUrl } from "@/lib/storage/supabase-storage";
import type { Server } from "socket.io";

declare global {
  var io: Server;
}

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  clientId: z.string().optional(), // Legacy single client (backward compat)
  clientIds: z.array(z.string()).optional(), // New: multiple clients
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
    // Get projects where client is assigned via ProjectClient relationship
    const projectClients = await prisma.projectClient.findMany({
      where: { clientId: userId },
      select: { projectId: true },
    });
    const projectIds = projectClients.map((pc) => pc.projectId);

    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
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
    clientIds,
    requestedById,
    requestId,
    price,
    teamMemberIds = [],
    milestones = [],
    questions = [],
  } = CreateSchema.parse(body);

  // Normalize clients: use clientIds if provided, fallback to legacy clientId
  const normalizedClientIds = clientIds?.length ? clientIds : clientId ? [clientId] : [];

  const project = await prisma.$transaction(
    async (tx) => {
      const p = await tx.project.create({
        data: {
          title,
          clientId: normalizedClientIds[0] ?? null, // Legacy field: use first client
          requestedById: requestedById ?? null,
          createdById: userId,
          price: price ?? null,
        },
      });

      // Create project-client relationships for all clients
      if (normalizedClientIds.length > 0) {
        await tx.projectClient.createMany({
          data: normalizedClientIds.map((cid) => ({
            projectId: p.id,
            clientId: cid,
          })),
          skipDuplicates: true,
        });
      }

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
        const request = await tx.clientProjectRequest.update({
          where: { id: requestId },
          data: { status: "ACCEPTED", projectId: p.id },
        });
        // Add the client's initial brief file to assets
        if (request.pdfUrl) {
          const signedUrl = await getSignedUrl(request.pdfUrl, 24 * 3600);
          const lower = request.pdfUrl.toLowerCase();
          let fileType = "application/pdf";
          if (lower.endsWith(".docx")) fileType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          else if (lower.endsWith(".md")) fileType = "text/markdown";
          else if (lower.endsWith(".txt")) fileType = "text/plain";

          let fileSize = 0;
          try {
            const head = await fetch(signedUrl, { method: "HEAD" });
            const cl = head.headers.get("content-length");
            if (cl) fileSize = parseInt(cl, 10) || 0;
          } catch { /* keep 0 */ }

          await tx.asset.create({
            data: {
              projectId: p.id,
              name: request.title + " (Initial Request)",
              fileUrl: signedUrl,
              fileType,
              fileSize,
              uploadedById: request.clientId,
              isVisibleToClient: true,
            },
          });
        }
      }

      return p;
    },
    {
      maxWait: 10000, // 10s to acquire transaction
      timeout: 60000, // 60s for transaction execution
    }
  );

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

  // Notify all clients if assigned
  if (normalizedClientIds.length > 0) {
    await Promise.all(
      normalizedClientIds.map((cid) =>
        sendNotification(
          cid,
          "PROJECT_UPDATE",
          "New Project Created",
          `A new project **${title}** has been created for you`,
          `/projects/${project.id}`
        )
      )
    );
  }

  // Emit real-time update with full project data
  if (global.io) {
    const fullProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        milestones: true,
        members: { include: { user: { select: { id: true, name: true, profilePicUrl: true } } } },
        client: { select: { id: true, name: true } },
      },
    });
    if (fullProject) {
      const projectsNS = global.io.of("/projects");
      projectsNS.to("manager_projects").emit("project_created", { project: fullProject });
      projectsNS.to(`project:${project.id}`).emit("project_created", { project: fullProject });
      for (const uid of [...teamMemberIds, ...normalizedClientIds]) {
        projectsNS.to(`user:${uid}`).emit("project_created", { project: fullProject });
      }
    }
  }

  return NextResponse.json({ data: project }, { status: 201 });
});

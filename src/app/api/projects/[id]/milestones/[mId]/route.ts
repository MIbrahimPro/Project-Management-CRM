import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/db/audit";
import { sendNotification } from "@/lib/notifications/notify";
import type { Server } from "socket.io";

declare global {
  var io: Server;
}

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"]).optional(),
  content: z.string().optional().nullable(),
});

export const PATCH = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id");
    const role = req.headers.get("x-user-role") ?? "";
    if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    if (!["ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

    const projectId = ctx?.params.id;
    const milestoneId = ctx?.params.mId;
    if (!projectId || !milestoneId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = PatchSchema.parse(await req.json());

    const existing = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.status !== undefined) {
      updateData.status = body.status;
      updateData.completedAt = body.status === "COMPLETED" ? new Date() : null;
    }

    const milestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: updateData,
    });

    // Handle project status based on milestone changes
    if (body.status === "COMPLETED") {
      // If this completion was the last incomplete milestone, auto-complete the project
      const remaining = await prisma.milestone.count({
        where: { projectId, status: { not: "COMPLETED" } },
      });
      if (remaining === 0) {
        await prisma.project.update({
          where: { id: projectId },
          data: { status: "COMPLETED" },
        });
      }
    } else if (body.status) {
      // body.status is NOT_STARTED, IN_PROGRESS, or BLOCKED here
      // If milestone changed away from COMPLETED, and project was COMPLETED, revert to ACTIVE
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { status: true },
      });
      if (project?.status === "COMPLETED") {
        await prisma.project.update({
          where: { id: projectId },
          data: { status: "ACTIVE" },
        });
      }
    }

    await logAction(userId, "MILESTONE_UPDATED", "Milestone", milestoneId, {
      changes: Object.keys(updateData),
    });

    // Fetch full project with includes for socket emission
    const fullProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        milestones: { orderBy: { order: "asc" } },
        members: {
          include: {
            user: { select: { id: true, name: true, profilePicUrl: true, role: true } },
          },
        },
        client: { select: { id: true, name: true, profilePicUrl: true } },
        projectClients: { select: { clientId: true } },
      },
    });

    // Emit real-time update so everyone sees milestone changes
    if (global.io && fullProject) {
      global.io.of("/projects").to(`project:${projectId}`).emit("project_updated", { project: fullProject });
    }

    if (body.status || body.title || body.content !== undefined) {
      const recipientIds = new Set<string>();
      if (fullProject?.clientId) recipientIds.add(fullProject.clientId);
      fullProject?.projectClients.forEach((c) => recipientIds.add(c.clientId));
      fullProject?.members.forEach((m) => recipientIds.add(m.userId));
      recipientIds.delete(userId);

      await Promise.all(
        Array.from(recipientIds).map((uid) =>
          sendNotification(
            uid,
            "PROJECT_UPDATE",
            "Milestone updated",
            `${milestone.title} was updated.`,
            `/projects/${projectId}`,
          ),
        ),
      );
    }

    return NextResponse.json({ data: milestone });
  }
);

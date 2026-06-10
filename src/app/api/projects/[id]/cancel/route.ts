import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/db/audit";
import type { Server } from "socket.io";

declare global {
  var io: Server;
}

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];

export const PATCH = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    if (!MANAGER_ROLES.includes(role)) forbidden();

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.status === "CANCELLED") {
      return NextResponse.json({ error: "Project is already cancelled" }, { status: 400 });
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { status: "CANCELLED" },
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

    await logAction(userId, "PROJECT_CANCELLED", "Project", projectId, {
      previousStatus: project.status,
      title: project.title,
    });

    // Notify all project members
    if (global.io) {
      global.io.of("/projects").to(`project:${projectId}`).emit("project_updated", { project: updated });
    }

    return NextResponse.json({ data: updated });
  }
);

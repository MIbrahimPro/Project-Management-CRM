import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

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
    if (!["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

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

    // If this completion was the last incomplete milestone, auto-complete the project.
    if (body.status === "COMPLETED") {
      const remaining = await prisma.milestone.count({
        where: { projectId, status: { not: "COMPLETED" } },
      });
      if (remaining === 0) {
        await prisma.project.update({
          where: { id: projectId },
          data: { status: "COMPLETED" },
        });
      }
    }

    await logAction(userId, "MILESTONE_UPDATED", "Milestone", milestoneId, {
      changes: Object.keys(updateData),
    });

    return NextResponse.json({ data: milestone });
  }
);

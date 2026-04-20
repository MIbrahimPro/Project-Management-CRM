import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";
import { deleteFile } from "@/lib/supabase-storage";
import { canTransitionWorkspacePost } from "@/lib/workspace-post-status";
import type { WorkspaceTaskStatus } from "@/components/workspaces/types";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["IDEA", "IN_PROGRESS", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"]).optional(),
  assigneeIds: z.array(z.string()).optional(),
  postedAt: z.string().datetime().optional().nullable(),
  attachments: z.array(z.string()).optional(),
  thumbnailPath: z.string().nullable().optional(),
});

function taskMediaPrefix(taskId: string): string {
  return `workspace-task-media/${taskId}/`;
}

/**
 * New uploads must live under `workspace-task-media/{taskId}/`.
 * Paths already stored on the task (e.g. legacy chat-media) may be kept or removed.
 */
function validateAttachmentPaths(taskId: string, paths: string[], previous: string[]): boolean {
  const prefix = taskMediaPrefix(taskId);
  return paths.every((p) => p.startsWith(prefix) || previous.includes(p));
}

export const PATCH = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const workspaceId = ctx?.params.id ?? "";
  const taskId = ctx?.params.taskId ?? "";

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { userId: true },
  });
  if (!member) forbidden();

  const existing = await prisma.workspaceTask.findFirst({
    where: { id: taskId, workspaceId },
    select: {
      id: true,
      status: true,
      attachments: true,
      thumbnailPath: true,
      postedAt: true,
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const body = patchSchema.parse(await req.json());
  const updateData: Record<string, unknown> = {};
  const userRole = req.headers.get("x-user-role") ?? "";

  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.status !== undefined) {
    const from = existing.status as WorkspaceTaskStatus;
    const to = body.status;
    if (!canTransitionWorkspacePost(userRole, from, to)) {
      return NextResponse.json(
        { error: "You cannot change this post to that status", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    updateData.status = body.status;
    if (body.status === "PUBLISHED" && !existing.postedAt) {
      updateData.postedAt = new Date();
    }
  }
  if (body.assigneeIds !== undefined) updateData.assigneeIds = body.assigneeIds;
  if (body.postedAt !== undefined) {
    updateData.postedAt = body.postedAt ? new Date(body.postedAt) : null;
  }

  if (body.attachments !== undefined) {
    if (!validateAttachmentPaths(taskId, body.attachments, existing.attachments)) {
      return NextResponse.json(
        { error: "Invalid attachment paths", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    const removed = existing.attachments.filter((p) => !body.attachments!.includes(p));
    for (const p of removed) {
      await deleteFile(p).catch(() => undefined);
    }
    if (existing.thumbnailPath && !body.attachments.includes(existing.thumbnailPath)) {
      updateData.thumbnailPath = null;
    }
    updateData.attachments = body.attachments;
  }

  if (body.thumbnailPath !== undefined) {
    const att = (body.attachments ?? existing.attachments) as string[];
    if (body.thumbnailPath !== null && !att.includes(body.thumbnailPath)) {
      return NextResponse.json(
        { error: "Thumbnail must be one of the attachments", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    if (
      body.thumbnailPath !== null &&
      !validateAttachmentPaths(taskId, [body.thumbnailPath], existing.attachments)
    ) {
      return NextResponse.json(
        { error: "Invalid thumbnail path", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    updateData.thumbnailPath = body.thumbnailPath;
  }

  const updated = await prisma.workspaceTask.update({
    where: { id: taskId },
    data: updateData,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      assigneeIds: true,
      attachments: true,
      thumbnailPath: true,
      postedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await logAction(userId, "WORKSPACE_TASK_UPDATED", "WorkspaceTask", taskId, { changes: Object.keys(updateData) });
  return NextResponse.json({ data: updated });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const workspaceId = ctx?.params.id ?? "";
  const taskId = ctx?.params.taskId ?? "";

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { userId: true },
  });
  if (!member) forbidden();

  const task = await prisma.workspaceTask.findFirst({
    where: { id: taskId, workspaceId },
    select: { id: true, createdById: true, attachments: true },
  });
  if (!task) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  if (task.createdById !== userId) {
    const userRole = req.headers.get("x-user-role") ?? "";
    if (!["ADMIN", "PROJECT_MANAGER"].includes(userRole)) forbidden();
  }

  for (const p of task.attachments) {
    await deleteFile(p).catch(() => undefined);
  }

  await prisma.workspaceTask.delete({ where: { id: taskId } });
  await logAction(userId, "WORKSPACE_TASK_DELETED", "WorkspaceTask", taskId, {});
  return NextResponse.json({ data: { id: taskId } });
});

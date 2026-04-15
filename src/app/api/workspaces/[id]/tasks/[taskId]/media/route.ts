import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { uploadFile, getSignedUrl, type StoragePath } from "@/lib/supabase-storage";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024;

function mediaPrefix(taskId: string): string {
  return `workspace-task-media/${taskId}/`;
}

/**
 * Uploads a file for a workspace task and appends its storage path to `attachments`.
 */
export const POST = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const workspaceId = ctx?.params.id ?? "";
  const taskId = ctx?.params.taskId ?? "";

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { userId: true },
  });
  if (!member) forbidden();

  const task = await prisma.workspaceTask.findFirst({
    where: { id: taskId, workspaceId },
    select: { id: true, attachments: true },
  });
  if (!task) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided", code: "VALIDATION_ERROR" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 20MB)", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || "bin";
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${mediaPrefix(taskId)}${unique}.${safeExt}` as StoragePath;

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(buffer, path, file.type || "application/octet-stream");

  const nextAttachments = [...task.attachments, path];

  const updated = await prisma.workspaceTask.update({
    where: { id: taskId },
    data: { attachments: nextAttachments },
    select: {
      id: true,
      attachments: true,
      thumbnailPath: true,
    },
  });

  const signedUrl = await getSignedUrl(path, 3600);

  await logAction(userId, "WORKSPACE_TASK_MEDIA_ADDED", "WorkspaceTask", taskId, { path });

  return NextResponse.json({
    data: { path, signedUrl, attachments: updated.attachments, thumbnailPath: updated.thumbnailPath },
  });
});

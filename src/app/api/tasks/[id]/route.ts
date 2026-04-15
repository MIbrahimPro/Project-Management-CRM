import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"]).optional(),
  projectId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
});

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (userRole === "CLIENT") forbidden();

  const id = ctx?.params.id ?? "";
  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      completedAt: true,
      projectId: true,
      workspaceId: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true, profilePicUrl: true } },
      project: { select: { id: true, title: true } },
      assignees: {
        select: {
          user: { select: { id: true, name: true, profilePicUrl: true, role: true } },
        },
      },
      chatRooms: { select: { id: true, type: true }, take: 1 },
    },
  });

  if (!task) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  // Access: manager or assignee or creator
  const isManager = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole);
  const canAccess =
    isManager ||
    task.createdById === userId ||
    task.assignees.some((a) => a.user.id === userId);
  if (!canAccess) forbidden();

  return NextResponse.json({ data: task });
});

export const PATCH = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (userRole === "CLIENT") forbidden();

  const id = ctx?.params.id ?? "";
  const body = patchSchema.parse(await req.json());

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      createdById: true,
      assignees: { select: { userId: true } },
      chatRooms: { select: { id: true }, take: 1 },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const isManager = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole);
  const isAssignee = task.assignees.some((a) => a.userId === userId);
  if (!isManager && task.createdById !== userId && !isAssignee) forbidden();

  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.projectId !== undefined) updateData.projectId = body.projectId;
  if (body.status !== undefined) {
    updateData.status = body.status;
    if (body.status === "DONE") updateData.completedAt = new Date();
    if (body.status !== "DONE") updateData.completedAt = null;
  }

  // Handle assignee updates (replace all)
  if (body.assigneeIds !== undefined) {
    await prisma.taskAssignee.deleteMany({ where: { taskId: id } });
    if (body.assigneeIds.length > 0) {
      await prisma.taskAssignee.createMany({
        data: body.assigneeIds.map((uid) => ({ taskId: id, userId: uid })),
        skipDuplicates: true,
      });
    }
    // Sync chat room members
    if (task.chatRooms[0]) {
      const roomId = task.chatRooms[0].id;
      await prisma.chatRoomMember.deleteMany({ where: { roomId } });
      const allMembers = [task.createdById, ...body.assigneeIds].filter(
        (v, i, a) => a.indexOf(v) === i
      );
      await prisma.chatRoomMember.createMany({
        data: allMembers.map((uid) => ({ roomId, userId: uid })),
        skipDuplicates: true,
      });
    }
  }

  const updated = await prisma.task.update({
    where: { id },
    data: updateData,
    select: {
      id: true, title: true, description: true, status: true,
      completedAt: true, updatedAt: true,
      assignees: { select: { user: { select: { id: true, name: true, profilePicUrl: true, role: true } } } },
    },
  });

  await logAction(userId, "TASK_UPDATED", "Task", id, { changes: Object.keys(updateData) });
  return NextResponse.json({ data: updated });
});

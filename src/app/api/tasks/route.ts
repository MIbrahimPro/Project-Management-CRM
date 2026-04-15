import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";
import { sendNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"]).optional(),
  projectId: z.string().optional().nullable(),
  workspaceId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (userRole === "CLIENT") forbidden();

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const workspaceId = searchParams.get("workspaceId");
  const status = searchParams.get("status");
  const mine = searchParams.get("mine") === "true";

  const isManager = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (projectId) where.projectId = projectId;
  if (workspaceId) where.workspaceId = workspaceId;

  // Non-managers only see tasks they created or are assigned to
  if (!isManager || mine) {
    where.OR = [
      { createdById: userId },
      { assignees: { some: { userId } } },
    ];
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      completedAt: true,
      projectId: true,
      workspaceId: true,
      createdAt: true,
      project: { select: { id: true, title: true } },
      assignees: {
        select: { user: { select: { id: true, name: true, profilePicUrl: true } } },
      },
    },
  });

  return NextResponse.json({ data: tasks });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (userRole === "CLIENT") forbidden();

  const body = createSchema.parse(await req.json());

  const task = await prisma.$transaction(async (tx) => {
    const t = await tx.task.create({
      data: {
        title: body.title,
        description: body.description,
        status: body.status ?? "TODO",
        projectId: body.projectId ?? null,
        workspaceId: body.workspaceId ?? null,
        createdById: userId,
        assignees: body.assigneeIds?.length
          ? { create: body.assigneeIds.map((id) => ({ userId: id })) }
          : undefined,
      },
      select: {
        id: true, title: true, status: true,
        projectId: true, workspaceId: true, createdAt: true,
        assignees: { select: { user: { select: { id: true, name: true } } } },
      },
    });

    // Create the task chat room and add creator + assignees
    const memberIds = [userId, ...(body.assigneeIds ?? []).filter((id) => id !== userId)];
    await tx.chatRoom.create({
      data: {
        type: "task_group",
        name: body.title,
        taskId: t.id,
        members: { create: memberIds.map((id) => ({ userId: id })) },
      },
    });

    return t;
  });

  // Notify assignees
  for (const a of task.assignees) {
    if (a.user.id !== userId) {
      await sendNotification(
        a.user.id,
        "TASK_ASSIGNED",
        "Task assigned",
        `You've been assigned to: **${task.title}**`,
        `/tasks/${task.id}`
      );
    }
  }

  await logAction(userId, "TASK_CREATED", "Task", task.id, { title: body.title });
  return NextResponse.json({ data: task }, { status: 201 });
});

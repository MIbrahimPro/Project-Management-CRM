import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (userRole === "CLIENT") forbidden();

  const taskId = ctx?.params.id ?? "";
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      createdById: true,
      assignees: { select: { userId: true } },
      chatRooms: { select: { id: true }, take: 1 },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const isManager = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole);
  const canAccess =
    isManager ||
    task.createdById === userId ||
    task.assignees.some((a) => a.userId === userId);
  if (!canAccess) forbidden();

  let room = task.chatRooms[0];

  if (!room) {
    // Create the chat room on demand
    const allMembers = [task.createdById, ...task.assignees.map((a) => a.userId)].filter(
      (v, i, a) => a.indexOf(v) === i
    );
    const created = await prisma.chatRoom.create({
      data: {
        type: "task_group",
        name: task.title,
        taskId,
        members: { create: allMembers.map((uid) => ({ userId: uid })) },
      },
      select: { id: true },
    });
    room = created;
  } else {
    // Ensure current user is a member
    await prisma.chatRoomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId } },
      update: {},
      create: { roomId: room.id, userId },
    });
  }

  return NextResponse.json({ data: { id: room.id } });
});

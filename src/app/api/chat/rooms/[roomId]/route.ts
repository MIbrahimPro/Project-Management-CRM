import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const DELETE = apiHandler(async (req: NextRequest, { params }: any) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const userRole = req.headers.get("x-user-role") ?? "";
  const { roomId } = params;

  // Check if room exists and user has permission
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId, deletedAt: null },
    include: { members: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const isGlobalManager = ["ADMIN", "PROJECT_MANAGER"].includes(userRole);
  const userMembership = room.members.find(m => m.userId === userId);
  const isGroupAdmin = userMembership?.isGroupAdmin;

  if (!isGlobalManager && !isGroupAdmin) {
    return forbidden();
  }

  if (room.type === "general_dm") {
    return NextResponse.json({ error: "Cannot delete direct message rooms" }, { status: 400 });
  }

  // Soft delete the room
  await prisma.chatRoom.update({
    where: { id: roomId },
    data: { deletedAt: new Date() },
  });

  await logAction(userId, "DELETE_CHAT_ROOM", "ChatRoom", roomId, { roomName: room.name, roomType: room.type });

  return NextResponse.json({ data: { success: true } });
});

export const PATCH = apiHandler(async (req: NextRequest, { params }: any) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const userRole = req.headers.get("x-user-role") ?? "";
  const { roomId } = params;
  const { name, adminsOnlyPosting, avatarUrl } = await req.json();

  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId, deletedAt: null },
    include: { members: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const isGlobalManager = ["ADMIN", "PROJECT_MANAGER"].includes(userRole);
  const userMembership = room.members.find(m => m.userId === userId);
  const isGroupAdmin = userMembership?.isGroupAdmin;

  if (!isGlobalManager && !isGroupAdmin) {
    return forbidden();
  }

  const updated = await prisma.chatRoom.update({
    where: { id: roomId },
    data: {
      name: name ?? undefined,
      adminsOnlyPosting: adminsOnlyPosting ?? undefined,
      avatarUrl: avatarUrl ?? undefined,
    },
  });

  return NextResponse.json({ data: updated });
});

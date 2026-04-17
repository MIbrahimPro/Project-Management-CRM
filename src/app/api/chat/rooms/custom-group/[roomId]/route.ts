import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getClientIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

const UpdateGroupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  userIds: z.array(z.string()).min(1, "At least one member is required"),
  adminIds: z.array(z.string()),
  adminsOnlyPosting: z.boolean(),
  avatarUrl: z.string().nullable().optional(),
});

export const PATCH = apiHandler(async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const role = req.headers.get("x-user-role") ?? "";
  const roomId = ctx?.params.roomId;

  if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: { members: true },
  });

  if (!room || room.type !== "custom_group") {
    return NextResponse.json({ error: "Group not found or invalid type" }, { status: 404 });
  }

  const isGlobalManager = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(role);
  const isGroupAdmin = room.members.find((m) => m.userId === userId)?.isGroupAdmin;

  if (!isGlobalManager && !isGroupAdmin) {
    forbidden();
  }

  const body = UpdateGroupSchema.parse(await req.json());

  // Ensure creator/current user remains a member to prevent locking oneself out accidentally,
  // although we should just trust the incoming IDs from the client UI.
  const memberIds = new Set(body.userIds);
  const adminIds = new Set(body.adminIds);

  // Validate users to ensure no CLIENT or SUPER_ADMIN
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(memberIds) } },
    select: { id: true, role: true },
  });
  if (users.some(u => u.role === "CLIENT" || u.role === "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Cannot add CLIENT or SUPER_ADMIN to groups" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    // 1. Update room properties
    await tx.chatRoom.update({
      where: { id: roomId },
      data: {
        name: body.name,
        avatarUrl: body.avatarUrl,
        adminsOnlyPosting: body.adminsOnlyPosting,
      },
    });

    // 2. Remove users not in memberIds
    const existingMemberIds = room.members.map((m) => m.userId);
    const toRemove = existingMemberIds.filter((id) => !memberIds.has(id));
    if (toRemove.length > 0) {
      await tx.chatRoomMember.deleteMany({
        where: { roomId, userId: { in: toRemove } },
      });
    }

    // 3. Upsert members with their admin status
    for (const mId of Array.from(memberIds)) {
      await tx.chatRoomMember.upsert({
        where: { roomId_userId: { roomId, userId: mId } },
        update: { isGroupAdmin: adminIds.has(mId) },
        create: {
          roomId,
          userId: mId,
          isGroupAdmin: adminIds.has(mId),
        },
      });
    }
  });

  await logAction(
    userId,
    "CHAT_ROOM_UPDATE",
    "ChatRoom",
    roomId,
    { type: "custom_group", name: body.name, memberCount: memberIds.size, adminsOnlyPosting: body.adminsOnlyPosting },
    getClientIp(req)
  );

  return NextResponse.json({ data: { success: true } });
});

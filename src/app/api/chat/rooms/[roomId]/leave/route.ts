import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest, { params }: any) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const { roomId } = params;

  // Check if user is a member of the room
  const membership = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
    include: { room: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this room" }, { status: 404 });
  }

  // Prevent leaving direct messages or system rooms if needed
  if (membership.room.type === "general_dm") {
    return NextResponse.json({ error: "Cannot leave a direct message room" }, { status: 400 });
  }

  // Remove membership
  await prisma.chatRoomMember.delete({
    where: { roomId_userId: { roomId, userId } },
  });

  await logAction(userId, "LEAVE_CHAT_ROOM", "ChatRoom", roomId, { roomName: membership.room.name });

  return NextResponse.json({ data: { success: true } });
});

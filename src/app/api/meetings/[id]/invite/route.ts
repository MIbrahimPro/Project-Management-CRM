import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { createNormalChatMessage } from "@/lib/chat-send-message";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const CLIENT_INVITER_ROLES_ALLOWED = ["ADMIN", "PROJECT_MANAGER"];

const InviteBodySchema = z.object({
  targetUserId: z.string().min(1),
});

export const POST = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const userRole = req.headers.get("x-user-role") ?? "";
  const meetingId = ctx?.params.id;

  if (userRole === "CLIENT") {
    return NextResponse.json(
      { error: "Client users cannot invite participants", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  if (!meetingId) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const body = InviteBodySchema.parse(await req.json());
  if (body.targetUserId === userId) {
    return NextResponse.json(
      { error: "You are already in the meeting", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      title: true,
      endedAt: true,
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  if (meeting.endedAt) {
    return NextResponse.json({ error: "Meeting has ended", code: "GONE" }, { status: 410 });
  }

  const inviterParticipant = await prisma.meetingParticipant.findUnique({
    where: { meetingId_userId: { meetingId, userId } },
    select: { id: true, leftAt: true },
  });

  if (!inviterParticipant || inviterParticipant.leftAt !== null) {
    forbidden();
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: body.targetUserId },
    select: { id: true, name: true, role: true, isActive: true },
  });

  if (!targetUser || !targetUser.isActive) {
    return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
  }

  if (targetUser.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetUser.role === "CLIENT" && !CLIENT_INVITER_ROLES_ALLOWED.includes(userRole)) {
    return NextResponse.json(
      { error: "Only Admin and Project Manager can invite client users", code: "FORBIDDEN_TARGET" },
      { status: 403 }
    );
  }

  const inviter = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });

  if (!inviter) {
    return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const existingDm = await prisma.chatRoom.findFirst({
    where: {
      type: "general_dm",
      members: { every: { userId: { in: [userId, targetUser.id] } } },
    },
    select: {
      id: true,
      members: { select: { userId: true } },
    },
  });

  const inviteRoomId =
    existingDm && existingDm.members.length === 2
      ? existingDm.id
      : (
          await prisma.chatRoom.create({
            data: {
              type: "general_dm",
              members: {
                create: [{ userId }, { userId: targetUser.id }],
              },
            },
            select: { id: true },
          })
        ).id;

  const message = await createNormalChatMessage({
    roomId: inviteRoomId,
    senderId: userId,
    content: `${inviter.name} invited you to join meeting: ${meeting.title}.`,
    mediaUrl: `/meetings/${meeting.id}`,
    mediaType: "meeting_invite",
  });

  await logAction(userId, "MEETING_INVITE_SENT", "Meeting", meeting.id, {
    targetUserId: targetUser.id,
    chatRoomId: inviteRoomId,
    messageId: message.id,
  });

  return NextResponse.json({
    data: {
      meetingId: meeting.id,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      messageId: message.id,
    },
  });
});

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";
import { sendNotification } from "@/lib/notify";
import { createNormalChatMessage } from "@/lib/chat-send-message";

export const dynamic = "force-dynamic";

/**
 * POST /api/attendance/ping
 * Manager pings an employee to confirm they are active.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const senderId = req.headers.get("x-user-id") ?? forbidden();
  const userRole = req.headers.get("x-user-role") ?? "";
  
  if (!["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole)) forbidden();

  const { targetUserId } = await req.json();
  if (!targetUserId) {
    return NextResponse.json({ error: "Missing targetUserId", code: "BAD_REQUEST" }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if already has an unanswered ping today
  const existingPing = await prisma.attendancePing.findFirst({
    where: {
      checkIn: { userId: targetUserId, date: today },
      status: "PENDING"
    }
  });

  if (existingPing) {
    return NextResponse.json({ error: "A ping is already pending for this user", code: "CONFLICT" }, { status: 409 });
  }

  // Get current active check-in
  const checkIn = await prisma.checkIn.findUnique({
    where: { userId_date: { userId: targetUserId, date: today } }
  });

  if (!checkIn) {
    return NextResponse.json({ error: "User is not checked in today", code: "NOT_FOUND" }, { status: 404 });
  }

  if (checkIn.checkedOutAt) {
    return NextResponse.json({ error: "User has already checked out", code: "CONFLICT" }, { status: 409 });
  }

  // Create ping
  const ping = await prisma.attendancePing.create({
    data: {
      checkInId: checkIn.id,
      senderId,
      status: "PENDING"
    }
  });

  // 1. Notification
  await sendNotification(
    targetUserId,
    "GENERAL",
    "Activity Check",
    "Your manager is checking if you're active. Please click to confirm.",
    `/api/attendance/confirm-active?pingId=${ping.id}`
  );

  // 2. System message in DM
  // Find or create DM
  let room = await prisma.chatRoom.findFirst({
    where: {
      type: "general_dm",
      members: { every: { userId: { in: [senderId, targetUserId] } } },
      AND: { members: { some: { userId: senderId } } }
    }
  });

  if (!room) {
    room = await prisma.chatRoom.create({
      data: {
        type: "general_dm",
        members: {
          create: [
            { userId: senderId, role: "member" },
            { userId: targetUserId, role: "member" }
          ]
        }
      }
    });
  }

  await createNormalChatMessage({
    roomId: room.id,
    senderId: senderId,
    content: `[ACTIVITY CHECK] Please confirm you are active by clicking the notification or visiting the attendance page.`,
  });

  await logAction(senderId, "ATTENDANCE_PING_SENT", "AttendancePing", ping.id, { targetUserId });

  return NextResponse.json({ data: ping });
});

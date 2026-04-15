import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sendNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

const PingSchema = z.object({
  targetUserId: z.string().min(1),
});

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"];

/**
 * POST /api/attendance/ping — PM sends an activity check to a user.
 * Creates an AwayPing and sends a push notification.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const role = req.headers.get("x-user-role") ?? "";

  if (!MANAGER_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const body = PingSchema.parse(await req.json());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkIn = await prisma.checkIn.findUnique({
    where: { userId_date: { userId: body.targetUserId, date: today } },
    select: { id: true, checkedOutAt: true },
  });

  if (!checkIn || checkIn.checkedOutAt) {
    return NextResponse.json({ error: "User is not checked in today", code: "NOT_FOUND" }, { status: 404 });
  }

  const ping = await prisma.awayPing.create({
    data: {
      checkInId: checkIn.id,
      sentAt: new Date(),
    },
  });

  await sendNotification(
    body.targetUserId,
    "AWAY_CHECK",
    "Activity Check",
    "Your manager is checking if you're active. Click to confirm.",
    `/api/attendance/confirm-active?pingId=${ping.id}`,
  );

  await logAction(userId, "PM_PING", "User", body.targetUserId);

  return NextResponse.json({ data: { pingId: ping.id } });
});

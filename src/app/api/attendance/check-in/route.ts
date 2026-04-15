import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ATTENDANCE_ROLES = [
  "ADMIN", "PROJECT_MANAGER", "DEVELOPER", "DESIGNER", "HR", "ACCOUNTANT", "SALES",
];

// POST /api/attendance/check-in — check in for the day
export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!ATTENDANCE_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Not eligible for attendance", code: "FORBIDDEN" }, { status: 403 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.checkIn.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  // Block re-check-in only while currently active (not checked out yet)
  if (existing && !existing.checkedOutAt) {
    return NextResponse.json({ error: "Already checked in today", code: "CONFLICT" }, { status: 409 });
  }

  const now = new Date();

  // Get user work hours to determine status
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { workHoursStart: true },
  });

  // Determine attendance status
  let status: "PRESENT" | "LATE" | "VERY_LATE" = "PRESENT";
  if (user?.workHoursStart) {
    const [h, m] = user.workHoursStart.split(":").map(Number);
    const shiftStart = new Date();
    shiftStart.setHours(h!, m!, 0, 0);
    const minutesLate = (now.getTime() - shiftStart.getTime()) / 60000;
    if (minutesLate > 60) status = "VERY_LATE";
    else if (minutesLate > 15) status = "LATE";
  }

  // If the user already had a session today (checked out), reopen it by clearing checkedOutAt.
  // Otherwise create a fresh CheckIn row.
  const checkIn = existing
    ? await prisma.checkIn.update({
        where: { id: existing.id },
        data: { checkedOutAt: null, checkedInAt: now },
      })
    : await prisma.checkIn.create({
        data: { userId, checkedInAt: now, date: today },
      });

  await prisma.attendance.upsert({
    where: { userId_date: { userId, date: today } },
    update: { status },
    create: { userId, date: today, status },
  });

  await logAction(userId, "CHECK_IN", "CheckIn", checkIn.id, { status, reopened: !!existing });

  return NextResponse.json({ data: { id: checkIn.id, checkedInAt: checkIn.checkedInAt, status } });
});

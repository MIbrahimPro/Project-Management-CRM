import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/attendance/check-out — check out for the day
export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkIn = await prisma.checkIn.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (!checkIn) {
    return NextResponse.json({ error: "No active check-in found", code: "NOT_FOUND" }, { status: 404 });
  }
  if (checkIn.checkedOutAt) {
    return NextResponse.json({ error: "Already checked out", code: "CONFLICT" }, { status: 409 });
  }

  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { workHoursEnd: true },
  });

  // Check if leaving early
  let leftEarly = false;
  if (user?.workHoursEnd) {
    const [h, m] = user.workHoursEnd.split(":").map(Number);
    const shiftEnd = new Date();
    shiftEnd.setHours(h!, m!, 0, 0);
    if (now < shiftEnd) leftEarly = true;
  }

  const updated = await prisma.checkIn.update({
    where: { id: checkIn.id },
    data: { checkedOutAt: now },
  });

  // Update attendance if left early
  if (leftEarly) {
    await prisma.attendance.update({
      where: { userId_date: { userId, date: today } },
      data: { status: "LEFT_EARLY" },
    });
  }

  await logAction(userId, "CHECK_OUT", "CheckIn", checkIn.id, { leftEarly });

  return NextResponse.json({ data: { checkedOutAt: updated.checkedOutAt, leftEarly } });
});

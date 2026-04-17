import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/attendance/overtime
 * Handle shift completion choices (checkout vs +1h overtime).
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const { checkInId, action } = await req.json();

  if (!checkInId || !action) {
    return NextResponse.json({ error: "Missing required fields", code: "BAD_REQUEST" }, { status: 400 });
  }

  const checkIn = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    include: { user: { select: { id: true } } }
  });

  if (!checkIn || checkIn.userId !== userId) {
    return NextResponse.json({ error: "Invalid check-in record", code: "FORBIDDEN" }, { status: 403 });
  }

  if (checkIn.checkedOutAt) {
    return NextResponse.json({ error: "Already checked out", code: "CONFLICT" }, { status: 409 });
  }

  const today = checkIn.date;

  if (action === "checkout") {
    const now = new Date();
    await prisma.checkIn.update({
      where: { id: checkInId },
      data: { checkedOutAt: now }
    });
    await logAction(userId, "CHECK_OUT", "CheckIn", checkInId, { manual: true, reason: "shift_complete" });
    return NextResponse.json({ success: true, action: "checkout" });
  }

  if (action === "overtime") {
    // Add 1 hour to overtimeHours on Attendance
    // And reset notified8h to false so we notify again in 1 hour? 
    // Chunk 13.8: "+1h -> re-notify each hour cycle, accumulate overtime"
    
    await prisma.$transaction(async (tx) => {
      await tx.attendance.update({
        where: { userId_date: { userId, date: today } },
        data: { overtimeHours: { increment: 1 } }
      });
      
      await tx.checkIn.update({
        where: { id: checkInId },
        data: { notified8h: false } // Reset to notify again after next hour
      });
    });

    await logAction(userId, "OVERTIME_STARTED", "Attendance", checkInId, { hour: 1 });
    return NextResponse.json({ success: true, action: "overtime" });
  }

  return NextResponse.json({ error: "Invalid action", code: "BAD_REQUEST" }, { status: 400 });
});

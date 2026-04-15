import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/attendance/status — today's check-in status for current user
export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkIn = await prisma.checkIn.findUnique({
    where: { userId_date: { userId, date: today } },
    select: {
      id: true,
      checkedInAt: true,
      checkedOutAt: true,
      isAutoCheckout: true,
      awayPings: {
        select: { id: true, sentAt: true, respondedAt: true, wasAway: true },
        orderBy: { sentAt: "desc" },
        take: 1,
      },
    },
  });

  const [attendance, userData] = await Promise.all([
    prisma.attendance.findUnique({
      where: { userId_date: { userId, date: today } },
      select: { status: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { workHoursEnd: true },
    }),
  ]);

  return NextResponse.json({
    data: {
      checkIn: checkIn ?? null,
      attendance: attendance ?? null,
      isCheckedIn: !!checkIn && !checkIn.checkedOutAt,
      workHoursEnd: userData?.workHoursEnd ?? null,
    },
  });
});

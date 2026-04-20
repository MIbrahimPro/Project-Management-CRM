import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!MANAGER_ROLES.includes(userRole)) forbidden();

  // Last 7 days (rolling window, not calendar week)
  const since = new Date();
  since.setDate(since.getDate() - 7);

  // Attendance records in the last 7 days
  const records = await prisma.attendance.findMany({
    where: { date: { gte: since } },
    select: {
      userId: true,
      date: true,
      status: true,
      user: { select: { id: true, name: true, role: true, profilePicUrl: true } },
    },
    orderBy: { date: "desc" },
  });

  // Group by user
  const byUser = new Map<string, typeof records>();
  for (const r of records) {
    const existing = byUser.get(r.userId) ?? [];
    existing.push(r);
    byUser.set(r.userId, existing);
  }

  const alerts: {
    user: { id: string; name: string; role: string; profilePicUrl: string | null };
    alertType: "ABSENT" | "VERY_LATE";
    count: number;
    dates: string[];
  }[] = [];

  for (const userRecords of Array.from(byUser.values())) {
    const user = userRecords[0].user;
    const absentDates = userRecords
      .filter((r) => r.status === "ABSENT")
      .map((r) => r.date.toISOString().split("T")[0]);
    const veryLateDates = userRecords
      .filter((r) => r.status === "VERY_LATE")
      .map((r) => r.date.toISOString().split("T")[0]);

    if (absentDates.length >= 2) {
      alerts.push({ user, alertType: "ABSENT", count: absentDates.length, dates: absentDates });
    }
    if (veryLateDates.length >= 3) {
      alerts.push({ user, alertType: "VERY_LATE", count: veryLateDates.length, dates: veryLateDates });
    }
  }

  // Sort: most severe first
  alerts.sort((a, b) => b.count - a.count);

  return NextResponse.json({ data: alerts });
});

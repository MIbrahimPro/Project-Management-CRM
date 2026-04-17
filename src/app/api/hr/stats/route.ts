import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const HR_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "HR"];

export const GET = apiHandler(async (req: NextRequest) => {
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!HR_ROLES.includes(userRole)) forbidden();

  // 1. Hiring Funnel
  const candidates = await prisma.candidate.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const hiringFunnel = [
    { name: "Applied", value: 0 },
    { name: "Shortlisted", value: 0 },
    { name: "Interviewed", value: 0 },
    { name: "Hired", value: 0 },
    { name: "Rejected", value: 0 },
  ];

  candidates.forEach(c => {
    if (c.status === "APPLIED" || c.status === "UNDER_REVIEW") hiringFunnel[0].value += c._count.id;
    if (c.status === "SHORTLISTED") hiringFunnel[1].value += c._count.id;
    if (c.status === "INTERVIEW_SCHEDULED") hiringFunnel[2].value += c._count.id;
    if (c.status === "HIRED") hiringFunnel[3].value += c._count.id;
    if (c.status === "REJECTED") hiringFunnel[4].value += c._count.id;
  });

  // 2. Attendance Stats (Last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    return d;
  }).reverse();

  const attendanceTrend = await Promise.all(last7Days.map(async (date) => {
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);

    const counts = await prisma.attendance.groupBy({
      by: ['status'],
      where: {
        date: {
          gte: date,
          lt: nextDay,
        },
      },
      _count: { id: true },
    });

    const present = counts.find(c => ["PRESENT", "LEFT_EARLY"].includes(c.status))?._count.id || 0;
    const late = counts.find(c => c.status === "LATE")?._count.id || 0;
    const absent = counts.find(c => c.status === "ABSENT")?._count.id || 0;

    return {
      name: date.toLocaleDateString('en-US', { weekday: 'short' }),
      present,
      late,
      absent,
    };
  }));

  // 3. Employee Distribution
  const roleDistribution = await prisma.user.groupBy({
    by: ['role'],
    where: {
      isActive: true,
      role: { notIn: ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "CLIENT"] },
    },
    _count: { id: true },
  });

  const roles = roleDistribution.map(r => ({
    name: r.role.replace(/_/g, " ").toLowerCase(),
    value: r._count.id,
  }));

  return NextResponse.json({
    data: {
      hiringFunnel,
      attendanceTrend,
      roles,
    }
  });
});

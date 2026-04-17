import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/management
 * Returns today's attendance status for all employees.
 * Manager/Admin only.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(userRole)) forbidden();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const employees = await prisma.user.findMany({
    where: {
      role: { notIn: ["SUPER_ADMIN", "CLIENT"] },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profilePicUrl: true,
      workHoursStart: true,
      workHoursEnd: true,
      attendance: {
        where: { date: today },
        select: { status: true, note: true }
      },
      checkIns: {
        where: { date: today, checkedOutAt: null },
        select: { id: true, checkedInAt: true, notified8h: true }
      }
    },
    orderBy: { name: "asc" }
  });

  // Fetch avatar signed URLs
  const { getSignedUrl } = await import("@/lib/supabase-storage");
  const data = await Promise.all(employees.map(async (e) => {
    let avatarSignedUrl = null;
    if (e.profilePicUrl) {
      try {
        avatarSignedUrl = await getSignedUrl(e.profilePicUrl);
      } catch (err) {}
    }
    return { ...e, avatarSignedUrl };
  }));

  return NextResponse.json({ data });
});

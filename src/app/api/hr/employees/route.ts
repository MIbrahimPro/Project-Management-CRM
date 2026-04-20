import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const HR_ROLES = ["ADMIN", "PROJECT_MANAGER", "HR"];
const EXCLUDED_ROLES = ["ADMIN", "PROJECT_MANAGER", "CLIENT"];

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!HR_ROLES.includes(userRole)) forbidden();

  const employees = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { notIn: EXCLUDED_ROLES as any },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      workMode: true,
      salary: true,
      profilePicUrl: true,
      createdAt: true,
      attendance: {
        where: {
          date: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) } // Last 30 days
        },
        select: { status: true }
      },
      taskAssignees: {
        include: {
          task: { select: { status: true } }
        }
      }
    },
  });

  const { getSignedUrl } = await import("@/lib/supabase-storage");

  // Parallel pre-generate signed URLs for avatars
  const data = await Promise.all(employees.map(async (emp) => {
    let avatarSignedUrl = null;
    if (emp.profilePicUrl) {
      try {
        avatarSignedUrl = await getSignedUrl(emp.profilePicUrl);
      } catch (err) {
        console.error(`[HR] Signed URL failed for ${emp.id}:`, err);
      }
    }

    // Punctuality: (PRESENT + LEFT_EARLY) / Total
    const activeDays = emp.attendance;
    const punctualDays = activeDays.filter(a => ["PRESENT", "LEFT_EARLY"].includes(a.status));
    const punctuality = activeDays.length > 0 ? Math.round((punctualDays.length / activeDays.length) * 100) : 100;

    // Task Completion
    const completedTasks = emp.taskAssignees.filter(ta => ta.task.status === "DONE").length;
    const totalTasks = emp.taskAssignees.length;

    return {
      id: emp.id,
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      role: emp.role,
      workMode: emp.workMode,
      salary: emp.salary,
      profilePicUrl: emp.profilePicUrl,
      avatarSignedUrl,
      memberSince: emp.createdAt,
      metrics: {
        punctuality,
        completedTasks,
        totalTasks
      }
    };
  }));

  return NextResponse.json({ data });
});

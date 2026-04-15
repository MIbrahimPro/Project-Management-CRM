import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { fetchDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

const dashboardGetQuerySchema = z.object({});

export const GET = apiHandler(async (req: NextRequest) => {
  dashboardGetQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

  const userId = req.headers.get("x-user-id") ?? forbidden();
  const roleRaw = req.headers.get("x-user-role") ?? forbidden();

  const roleResult = z.nativeEnum(UserRole).safeParse(roleRaw);
  const role: UserRole = roleResult.success ? roleResult.data : forbidden();

  const data = await fetchDashboardData(userId, role);
  return NextResponse.json({ data });
});

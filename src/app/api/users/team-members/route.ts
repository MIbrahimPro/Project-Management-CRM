import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

// Internal team roles (excludes SUPER_ADMIN, ADMIN, CLIENT)
const TEAM_ROLES: UserRole[] = [
  "PROJECT_MANAGER",
  "DEVELOPER",
  "DESIGNER",
  "HR",
  "ACCOUNTANT",
  "SALES",
];

export const GET = apiHandler(async (req: NextRequest) => {
  const role = req.headers.get("x-user-role") ?? "";
  if (!["ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

  const members = await prisma.user.findMany({
    where: { role: { in: TEAM_ROLES }, isActive: true },
    select: { id: true, name: true, role: true, profilePicUrl: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: members });
});

import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const viewerRole = req.headers.get("x-user-role") ?? "";

  const isAdminOrPM = ["ADMIN", "PROJECT_MANAGER"].includes(viewerRole);

  const where: any = {
    isActive: true,
    id: { not: userId },
    role: { not: "SUPER_ADMIN" }, // SUPER_ADMIN is a hidden role
  };

  if (viewerRole === "CLIENT") {
    // Clients only see Managers and Admins
    where.role = { in: ["ADMIN", "PROJECT_MANAGER"] };
  } else if (!isAdminOrPM) {
    // Regular team members (Dev, Designer, HR, etc.) see everyone except CLIENT and SUPER_ADMIN
    where.role = { notIn: ["SUPER_ADMIN", "CLIENT"] };
  }

  const users = await prisma.user.findMany({
    where: {
      ...where,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true, role: true, profilePicUrl: true },
    orderBy: { name: "asc" },
    take: 100,
  });

  return NextResponse.json({ data: users });
});

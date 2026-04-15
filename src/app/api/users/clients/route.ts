import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const role = req.headers.get("x-user-role") ?? "";
  if (!["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

  const clients = await prisma.user.findMany({
    where: { role: "CLIENT", isActive: true },
    select: { id: true, name: true, profilePicUrl: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: clients });
});

import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: userId }, // exclude self
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true, role: true, profilePicUrl: true },
    orderBy: { name: "asc" },
    take: 20,
  });

  return NextResponse.json({ data: users });
});

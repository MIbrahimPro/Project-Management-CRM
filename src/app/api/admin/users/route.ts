import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserManagement } from "@/lib/admin-user-management";

export const dynamic = "force-dynamic";

// GET /api/admin/users — all users with session count
export async function GET(req: NextRequest) {
  const guard = requireUserManagement(req);
  if (guard) return guard;

  const search = req.nextUrl.searchParams.get("q") ?? "";

  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      workMode: true,
      statedRole: true,
      isActive: true,
      profilePicUrl: true,
      createdAt: true,
      _count: { select: { sessions: true } },
    },
  });

  return NextResponse.json({ data: users });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function superAdminOnly(req: NextRequest) {
  if (req.headers.get("x-user-role") !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

// GET /api/super-admin/blacklist — token blacklist stats and theft attempts
export async function GET(req: NextRequest) {
  const guard = superAdminOnly(req);
  if (guard) return guard;

  const now = new Date();

  const [totalCount, expiredCount, theftAttempts] = await prisma.$transaction([
    prisma.refreshTokenBlacklist.count(),
    prisma.refreshTokenBlacklist.count({ where: { expiresAt: { lt: now } } }),
    prisma.refreshTokenBlacklist.findMany({
      where: { reusedOnce: true },
      orderBy: { blacklistedAt: "desc" },
      take: 20,
      select: {
        id: true,
        userId: true,
        blacklistedAt: true,
        graceUntil: true,
        expiresAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      totalCount,
      activeCount: totalCount - expiredCount,
      expiredCount,
      theftAttempts,
    },
  });
}

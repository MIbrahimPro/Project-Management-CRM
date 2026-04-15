import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

function superAdminOnly(req: NextRequest) {
  if (req.headers.get("x-user-role") !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

// GET /api/super-admin/sessions — all active sessions
export async function GET(req: NextRequest) {
  const guard = superAdminOnly(req);
  if (guard) return guard;

  const sessions = await prisma.session.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      deviceId: true,
      userAgentFamily: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return NextResponse.json({ data: sessions });
}

// DELETE /api/super-admin/sessions — kill one or all sessions for a user
const deleteSchema = z.union([
  z.object({ sessionId: z.string() }),
  z.object({ userId: z.string() }),
]);

export async function DELETE(req: NextRequest) {
  const guard = superAdminOnly(req);
  if (guard) return guard;
  const adminId = req.headers.get("x-user-id")!;
  const body = deleteSchema.parse(await req.json());

  if ("sessionId" in body) {
    await prisma.session.delete({ where: { id: body.sessionId } });
    await logAction(adminId, "KILL_SESSION", "Session", body.sessionId);
    return NextResponse.json({ data: { killed: 1 } });
  } else {
    const { count } = await prisma.session.deleteMany({ where: { userId: body.userId } });
    await logAction(adminId, "KILL_ALL_SESSIONS", "User", body.userId, { count });
    return NextResponse.json({ data: { killed: count } });
  }
}

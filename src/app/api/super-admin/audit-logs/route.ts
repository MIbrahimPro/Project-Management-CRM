import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function superAdminOnly(req: NextRequest) {
  if (req.headers.get("x-user-role") !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

// GET /api/super-admin/audit-logs?action=&entity=
export async function GET(req: NextRequest) {
  const guard = superAdminOnly(req);
  if (guard) return guard;

  const action = req.nextUrl.searchParams.get("action") ?? undefined;
  const entity = req.nextUrl.searchParams.get("entity") ?? undefined;

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
      ...(entity ? { entity: { contains: entity, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      userId: true,
      action: true,
      entity: true,
      entityId: true,
      metadata: true,
      ipAddress: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: logs });
}

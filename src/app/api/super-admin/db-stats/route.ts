import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function superAdminOnly(req: NextRequest) {
  if (req.headers.get("x-user-role") !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

type CountRow = { count: bigint };

// GET /api/super-admin/db-stats — raw row counts for key tables
export async function GET(req: NextRequest) {
  const guard = superAdminOnly(req);
  if (guard) return guard;

  const tables = [
    "User", "Session", "Project", "Task", "WorkspaceTask",
    "Message", "Document", "Notification", "AuditLog",
    "CheckIn", "Attendance", "AccountEntry", "HiringRequest",
    "HiringCandidate", "ChatRoom", "Workspace",
  ];

  const results = await Promise.all(
    tables.map(async (table) => {
      const rows = await prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::int AS count FROM "${table}"`
      );
      return { table, count: Number(rows[0]?.count ?? 0) };
    })
  );

  return NextResponse.json({ data: results });
}

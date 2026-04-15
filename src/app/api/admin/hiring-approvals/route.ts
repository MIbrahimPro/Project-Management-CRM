import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"];

function adminOnly(req: NextRequest) {
  if (!ADMIN_ROLES.includes(req.headers.get("x-user-role") ?? "")) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }
  return null;
}

// GET /api/admin/hiring-approvals — pending admin approval requests
export async function GET(req: NextRequest) {
  const guard = adminOnly(req);
  if (guard) return guard;

  const requests = await prisma.hiringRequest.findMany({
    where: { adminApproved: false, status: { not: "DRAFT" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      statedRole: true,
      publicTitle: true,
      status: true,
      managerApproved: true,
      hrApproved: true,
      adminApproved: true,
      createdAt: true,
      deadline: true,
      _count: { select: { candidates: true } },
      requestedBy: { select: { id: true, name: true, role: true } },
      hr: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: requests });
}

// PATCH /api/admin/hiring-approvals/[id] handled via the [id] route

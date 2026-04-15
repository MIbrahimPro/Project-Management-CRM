import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import {
  projectManagerCannotAssignPrivilegedRole,
  projectManagerCannotModifyUser,
  requireUserManagement,
} from "@/lib/admin-user-management";

export const dynamic = "force-dynamic";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const patchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum([
    "SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "DEVELOPER",
    "DESIGNER", "HR", "ACCOUNTANT", "SALES", "CLIENT",
  ]).optional(),
  workMode: z.enum(["REMOTE", "ONSITE", "HYBRID"]).optional(),
  statedRole: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
  workHoursStart: z.string().regex(timeRegex).nullable().optional(),
  workHoursEnd: z.string().regex(timeRegex).nullable().optional(),
});

// PATCH /api/admin/users/[id] — edit role, name, workMode, statedRole, isActive
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireUserManagement(req);
  if (guard) return guard;
  const adminId = req.headers.get("x-user-id")!;
  const actorRole = req.headers.get("x-user-role") ?? "";

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true, isActive: true },
  });
  if (!user) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  // Non-SUPER_ADMIN cannot edit SUPER_ADMIN
  if (user.role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  if (projectManagerCannotModifyUser(actorRole, user.role)) {
    return NextResponse.json(
      { error: "Cannot modify administrator accounts", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const body = patchSchema.parse(await req.json());

  if (projectManagerCannotAssignPrivilegedRole(actorRole, body.role)) {
    return NextResponse.json(
      { error: "Cannot assign administrator role", code: "FORBIDDEN" },
      { status: 403 }
    );
  }
  const updated = await prisma.user.update({
    where: { id: params.id },
    data: body,
    select: {
      id: true, name: true, email: true, role: true,
      workMode: true, statedRole: true, isActive: true,
      workHoursStart: true, workHoursEnd: true,
    },
  });

  await logAction(adminId, "ADMIN_UPDATE_USER", "User", params.id, body);
  return NextResponse.json({ data: updated });
}

// GET /api/admin/users/[id] — user with active sessions
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireUserManagement(req);
  if (guard) return guard;

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true, role: true, workMode: true,
      statedRole: true, isActive: true, createdAt: true,
      workHoursStart: true, workHoursEnd: true,
      sessions: {
        where: { expiresAt: { gt: new Date() } },
        select: {
          id: true, deviceId: true, userAgentFamily: true,
          userAgent: true, ipAddress: true, lastUsedAt: true, expiresAt: true,
        },
        orderBy: { lastUsedAt: "desc" },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ data: user });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { projectManagerCannotModifyUser, requireUserManagement } from "@/lib/admin-user-management";

export const dynamic = "force-dynamic";

// DELETE /api/admin/users/[id]/sessions — kill one or all sessions for user
const bodySchema = z.union([
  z.object({ sessionId: z.string() }),
  z.object({ all: z.literal(true) }),
]);

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireUserManagement(req);
  if (guard) return guard;
  const adminId = req.headers.get("x-user-id")!;
  const actorRole = req.headers.get("x-user-role") ?? "";

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  if (target.role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Cannot modify SUPER_ADMIN sessions", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  if (projectManagerCannotModifyUser(actorRole, target.role)) {
    return NextResponse.json(
      { error: "Cannot modify administrator sessions", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const body = bodySchema.parse(await req.json());

  if ("sessionId" in body) {
    await prisma.session.deleteMany({
      where: { id: body.sessionId, userId: params.id },
    });
    await logAction(adminId, "KILL_SESSION", "Session", body.sessionId, { userId: params.id });
    return NextResponse.json({ data: { killed: 1 } });
  } else {
    const { count } = await prisma.session.deleteMany({ where: { userId: params.id } });
    await logAction(adminId, "KILL_ALL_SESSIONS", "User", params.id, { count });
    return NextResponse.json({ data: { killed: count } });
  }
}

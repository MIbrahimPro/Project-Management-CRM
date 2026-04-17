import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"];

function adminOnly(req: NextRequest) {
  if (!ADMIN_ROLES.includes(req.headers.get("x-user-role") ?? "")) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }
  return null;
}

const patchSchema = z.object({
  adminApproved: z.boolean(),
});

// PATCH /api/admin/hiring-approvals/[id] — approve or reject (set adminApproved)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = adminOnly(req);
  if (guard) return guard;
  const adminId = req.headers.get("x-user-id")!;

  const request = await prisma.hiringRequest.findUnique({
    where: { id: params.id },
    select: { id: true, adminApproved: true, status: true },
  });
  if (!request) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const { adminApproved } = patchSchema.parse(await req.json());

  const updated = await prisma.hiringRequest.update({
    where: { id: params.id },
    data: {
      adminApproved,
      // If admin approves and both manager + HR have approved, mark OPEN
      ...(adminApproved ? {} : { status: "DRAFT" }),
    },
    select: {
      id: true, adminApproved: true, managerApproved: true,
      hrApproved: true, status: true,
    },
  });

  await logAction(
    adminId,
    adminApproved ? "ADMIN_APPROVE_HIRING" : "ADMIN_REJECT_HIRING",
    "HiringRequest",
    params.id
  );

  return NextResponse.json({ data: updated });
}

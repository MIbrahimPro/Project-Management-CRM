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

// GET /api/super-admin/system-config
export async function GET(req: NextRequest) {
  const guard = superAdminOnly(req);
  if (guard) return guard;
  const configs = await prisma.systemConfig.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json({ data: configs });
}

// PATCH /api/super-admin/system-config
const patchSchema = z.object({ key: z.string(), value: z.string() });

export async function PATCH(req: NextRequest) {
  const guard = superAdminOnly(req);
  if (guard) return guard;
  const userId = req.headers.get("x-user-id")!;
  const body = patchSchema.parse(await req.json());
  const updated = await prisma.systemConfig.update({
    where: { key: body.key },
    data: { value: body.value, updatedBy: userId },
  });
  await logAction(userId, "UPDATE_SYSTEM_CONFIG", "SystemConfig", updated.id, { key: body.key, value: body.value });
  return NextResponse.json({ data: updated });
}

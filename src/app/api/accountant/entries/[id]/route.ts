import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"];

const patchSchema = z.object({
  isVoid: z.boolean().optional(),
  voidReason: z.string().optional(),
  description: z.string().min(1).max(500).optional(),
});

export const PATCH = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!FINANCE_ROLES.includes(userRole)) forbidden();

  const id = ctx?.params.id ?? "";
  const body = patchSchema.parse(await req.json());

  const existing = await prisma.accountEntry.findUnique({
    where: { id },
    select: { id: true, isVoid: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  if (existing.isVoid) {
    return NextResponse.json({ error: "Entry is already voided", code: "CONFLICT" }, { status: 409 });
  }

  const updated = await prisma.accountEntry.update({
    where: { id },
    data: {
      ...(body.isVoid !== undefined ? { isVoid: body.isVoid } : {}),
      ...(body.voidReason !== undefined ? { voidReason: body.voidReason } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
    },
    select: { id: true, isVoid: true, voidReason: true, description: true },
  });

  await logAction(userId, "ACCOUNT_ENTRY_UPDATED", "AccountEntry", id, {
    changes: Object.keys(body),
  });

  return NextResponse.json({ data: updated });
});

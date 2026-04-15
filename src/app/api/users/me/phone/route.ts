import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const PhoneSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[0-9\s\-\(\)]{7,20}$/, "Invalid phone number format")
    .nullable(),
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const body = PhoneSchema.parse(await req.json());

  const normalizedPhone = body.phone?.trim() || null;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { phone: normalizedPhone },
    select: { id: true, phone: true },
  });

  await logAction(
    userId,
    "PROFILE_PHONE_UPDATED",
    "User",
    updated.id,
    { phone: updated.phone },
    ip
  );

  return NextResponse.json({ data: { phone: updated.phone } });
});

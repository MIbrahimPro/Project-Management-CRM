import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const NameSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name too long")
    .regex(
      /^[a-zA-Z\s\-']+$/,
      "Name can only contain letters, spaces, hyphens, and apostrophes"
    ),
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const body = NameSchema.parse(await req.json());

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name: body.name.trim() },
    select: { id: true, name: true },
  });

  await logAction(
    userId,
    "PROFILE_NAME_UPDATED",
    "User",
    updated.id,
    { name: updated.name },
    ip
  );

  return NextResponse.json({ data: { name: updated.name } });
});

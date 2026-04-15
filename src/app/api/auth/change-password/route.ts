import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { checkRateLimit } from "@/lib/redis";
import { clearAuthCookies, getCookie } from "@/lib/auth-helpers";
import { hashToken } from "@/lib/tokens";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const PasswordSchema = z.string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "At least one uppercase letter")
  .regex(/[a-z]/, "At least one lowercase letter")
  .regex(/[0-9]/, "At least one number")
  .regex(/[^A-Za-z0-9]/, "At least one special character");

const ChangePasswordSchema = z.object({
  oldPassword: z.string(),
  newPassword: PasswordSchema,
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id")!;
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  const allowed = await checkRateLimit(`change_password:${userId}`, 5, 3600);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts", code: "RATE_LIMITED" }, { status: 429 });
  }

  const body = ChangePasswordSchema.parse(await req.json());

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    await bcrypt.compare(body.oldPassword, "$2b$12$invalidhashforfakingbcrypttime");
    return NextResponse.json({ error: "Invalid credentials", code: "INVALID_CREDENTIALS" }, { status: 400 });
  }

  const oldMatch = await bcrypt.compare(body.oldPassword, user.passwordHash);
  if (!oldMatch) {
    return NextResponse.json({ error: "Invalid credentials", code: "INVALID_CREDENTIALS" }, { status: 400 });
  }

  const newPasswordHash = await bcrypt.hash(body.newPassword, 12);

  const refreshToken = getCookie(req, "refresh_token");
  const currentSession = refreshToken
    ? await prisma.session.findUnique({ where: { refreshToken: hashToken(refreshToken) }, select: { id: true } })
    : null;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    }),
    currentSession
      ? prisma.session.deleteMany({ where: { userId, id: { not: currentSession.id } } })
      : prisma.session.deleteMany({ where: { userId } }),
  ]);

  await logAction(userId, "PASSWORD_CHANGED", "User", userId, null, ip);

  return NextResponse.json({ data: { success: true } });
});

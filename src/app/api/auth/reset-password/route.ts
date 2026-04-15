import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { checkRateLimit } from "@/lib/redis";
import { REFRESH_TOKEN_SECRET, generateAccessToken, generateRefreshToken, generateDeviceId, hashToken, parseUserAgentFamily, REFRESH_TOKEN_EXPIRY_SECONDS, ACCESS_TOKEN_EXPIRY_SECONDS } from "@/lib/tokens";
import { getCookie, clearFlowCookies, clearAuthCookies, setAuthCookies } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const PasswordSchema = z.string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "At least one uppercase letter")
  .regex(/[a-z]/, "At least one lowercase letter")
  .regex(/[0-9]/, "At least one number")
  .regex(/[^A-Za-z0-9]/, "At least one special character");

const ResetSchema = z.object({
  password: PasswordSchema,
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export const POST = apiHandler(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const allowed = await checkRateLimit(`reset:${ip}`, 5, 900);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts", code: "RATE_LIMITED" }, { status: 429 });
  }

  const resetFlowCookie = getCookie(req, "reset_flow");
  if (!resetFlowCookie) {
    return NextResponse.json({ error: "Session expired. Request a new code.", code: "SESSION_EXPIRED" }, { status: 401 });
  }

  let payload: { userId: string } | null = null;
  try {
    payload = jwt.verify(resetFlowCookie, REFRESH_TOKEN_SECRET) as { userId: string };
  } catch {
    return NextResponse.json({ error: "Session expired. Request a new code.", code: "SESSION_EXPIRED" }, { status: 401 });
  }

  const body = ResetSchema.parse(await req.json());

  const passwordHash = await bcrypt.hash(body.password, 12);
  const userAgent = req.headers.get("user-agent") || "";
  const deviceId = generateDeviceId();
  const refreshToken = generateRefreshToken();

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true },
  });

  const accessToken = generateAccessToken(payload.userId, user?.role || "CLIENT");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash },
    }),
    prisma.session.deleteMany({ where: { userId: payload.userId } }),
    prisma.session.create({
      data: {
        userId: payload.userId,
        deviceId,
        userAgentFamily: parseUserAgentFamily(userAgent),
        userAgent: userAgent.substring(0, 500),
        ipAddress: ip,
        refreshToken: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000),
        lastUsedAt: new Date(),
      },
    }),
  ]);

  await logAction(payload.userId, "PASSWORD_RESET", "User", payload.userId, null, ip);

  const res = NextResponse.json({ data: { success: true, message: "Password reset successfully." } });
  clearFlowCookies(res);
  return setAuthCookies(res, refreshToken, accessToken);
});

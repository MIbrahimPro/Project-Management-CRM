import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { checkRateLimit } from "@/lib/redis";
import { getClientIp, getRateLimitClientKey } from "@/lib/request-ip";
import { generateAccessToken, generateRefreshToken, generateDeviceId, hashToken, parseUserAgentFamily, REFRESH_TOKEN_EXPIRY_SECONDS } from "@/lib/tokens";
import { setAuthCookies } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password required"),
});

const USER_SELECT = {
  id: true, name: true, email: true, role: true, profilePicUrl: true,
  isActive: true, passwordHash: true, workHoursStart: true, workHoursEnd: true,
  currencyPreference: true, statedRole: true, workMode: true,
};

export const POST = apiHandler(async (req: NextRequest) => {
  if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
    console.error("[Login] FATAL: JWT secrets not configured in environment");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const ip = getClientIp(req);
  const rateLimitKey = getRateLimitClientKey(req);
  const allowed = await Promise.race<boolean>([
    checkRateLimit(`login:${rateLimitKey}`, 10, 900),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 1500)),
  ]).catch(() => true);
  if (!allowed) {
    return NextResponse.json({ error: "Too many login attempts", code: "RATE_LIMITED" }, { status: 429 });
  }

  const body = LoginSchema.parse(await req.json());
  const userAgent = req.headers.get("user-agent") || "";

  const user = await prisma.user.findUnique({ where: { email: body.email }, select: USER_SELECT });
  const GENERIC_ERROR = { error: "Invalid email or password", code: "INVALID_CREDENTIALS" };

  if (!user || !user.passwordHash) {
    await bcrypt.compare(body.password, "$2b$12$invalidhashforfakingbcrypttime");
    return NextResponse.json(GENERIC_ERROR, { status: 401 });
  }
  if (!user.isActive) {
    await bcrypt.compare(body.password, "$2b$12$invalidhashforfakingbcrypttime");
    return NextResponse.json(GENERIC_ERROR, { status: 401 });
  }
  
  const passwordMatch = await bcrypt.compare(body.password, user.passwordHash);
  if (!passwordMatch) {
    await logAction(null, "LOGIN_FAILED", "User", user.id, { email: body.email }, ip);
    return NextResponse.json(GENERIC_ERROR, { status: 401 });
  }

  const deviceId = generateDeviceId();
  const refreshToken = generateRefreshToken();
  const accessToken = generateAccessToken(user.id, user.role);
  const userAgentFamily = parseUserAgentFamily(userAgent);

  await prisma.$transaction([
    prisma.session.create({
      data: {
        userId: user.id,
        deviceId,
        userAgentFamily,
        userAgent: userAgent.substring(0, 500),
        ipAddress: ip,
        refreshToken: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000),
        lastUsedAt: new Date(),
      },
    }),
    prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    }),
  ]);

  await logAction(user.id, "LOGIN", "User", user.id, { deviceId, userAgentFamily }, ip);

  const { passwordHash: _, ...safeUser } = user;
  const res = NextResponse.json({ data: { user: safeUser } });
  return setAuthCookies(res, refreshToken, accessToken);
});

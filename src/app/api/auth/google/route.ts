import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { generateAccessToken, generateRefreshToken, generateDeviceId, hashToken, parseUserAgentFamily, REFRESH_TOKEN_EXPIRY_SECONDS } from "@/lib/tokens";
import { setAuthCookies } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const GoogleSchema = z.object({
  code: z.string(),
  flow: z.enum(["login", "connect"]),
  googleUser: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    picture: z.string().optional(),
  }),
  googleRefreshToken: z.string().nullable(),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body = GoogleSchema.parse(await req.json());
  const { googleUser, googleRefreshToken, flow } = body;
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const userAgent = req.headers.get("user-agent") || "";

  if (flow === "login") {
    const user = await prisma.user.findUnique({
      where: { email: googleUser.email },
      select: {
        id: true, name: true, email: true, role: true, profilePicUrl: true,
        isActive: true, isGoogleConnected: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "No account found with this Google email. Please sign up first.", code: "NO_ACCOUNT" }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Account is disabled", code: "ACCOUNT_DISABLED" }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isGoogleConnected: true, googleRefreshToken },
    });

    const deviceId = generateDeviceId();
    const refreshToken = generateRefreshToken();
    const accessToken = generateAccessToken(user.id, user.role);

    await prisma.$transaction([
      prisma.session.create({
        data: {
          userId: user.id,
          deviceId,
          userAgentFamily: parseUserAgentFamily(userAgent),
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

    await logAction(user.id, "LOGIN_GOOGLE", "User", user.id, { deviceId }, ip);

    const res = NextResponse.json({ data: { user } });
    return setAuthCookies(res, refreshToken, accessToken);
  }

  if (flow === "connect") {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isGoogleConnected: true, googleRefreshToken },
    });

    await logAction(userId, "GOOGLE_CONNECTED", "User", userId, null, ip);

    return NextResponse.json({ data: { success: true } });
  }

  return NextResponse.json({ error: "Invalid flow", code: "VALIDATION_ERROR" }, { status: 400 });
});

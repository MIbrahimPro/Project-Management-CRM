import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { checkRateLimit, blacklistToken, getBlacklistEntry, markTokenReused } from "@/lib/redis";
import { generateAccessToken, generateRefreshToken, hashToken, parseUserAgentFamily, REFRESH_TOKEN_EXPIRY_SECONDS, ACCESS_TOKEN_EXPIRY_SECONDS } from "@/lib/tokens";
import { setAuthCookies, clearAuthCookies, getCookie } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const allowed = await checkRateLimit(`refresh:${ip}`, 30, 900);
  if (!allowed) {
    return NextResponse.json({ error: "Too many refresh attempts", code: "RATE_LIMITED" }, { status: 429 });
  }

  const refreshToken = getCookie(req, "refresh_token");
  if (!refreshToken) {
    return NextResponse.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const tokenHash = hashToken(refreshToken);
  const session = await prisma.session.findUnique({
    where: { refreshToken: tokenHash },
    include: { user: { select: { id: true, role: true, isActive: true } } },
  });

  if (!session || !session.user.isActive) {
    return NextResponse.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  if (session.expiresAt < new Date()) {
    return NextResponse.json({ error: "Session expired", code: "SESSION_EXPIRED" }, { status: 401 });
  }

  // Check Redis blacklist for theft detection
  const blacklistEntry = await getBlacklistEntry(tokenHash);
  const userAgent = req.headers.get("user-agent") || "";
  const currentUAFamily = parseUserAgentFamily(userAgent);

  if (blacklistEntry) {
    const graceExpired = Date.now() > blacklistEntry.graceUntil;
    const alreadyReused = blacklistEntry.reusedOnce;

    if (graceExpired || alreadyReused) {
      // THEFT DETECTED — destroy all sessions
      const allSessions = await prisma.session.findMany({ where: { userId: session.userId }, select: { deviceId: true } });
      await prisma.session.deleteMany({ where: { userId: session.userId } });
      await blacklistToken(tokenHash, session.userId, 0, ACCESS_TOKEN_EXPIRY_SECONDS * 1000);
      const res = NextResponse.json({ error: "Session compromised", code: "SESSION_COMPROMISED" }, { status: 403 });
      await logAction(session.userId, "SESSION_COMPROMISED", "User", session.userId, { deviceId: session.deviceId }, ip);
      return clearAuthCookies(res);
    }

    // Grace period still active and first reuse — allow but mark
    await markTokenReused(tokenHash);
  }

  // Device family check (Mobile vs Desktop = significant change)
  if (currentUAFamily !== session.userAgentFamily) {
    const allSessions = await prisma.session.findMany({ where: { userId: session.userId }, select: { deviceId: true } });
    await prisma.session.deleteMany({ where: { userId: session.userId } });
    await blacklistToken(tokenHash, session.userId, 0, ACCESS_TOKEN_EXPIRY_SECONDS * 1000);
    const res = NextResponse.json({ error: "Session compromised", code: "SESSION_COMPROMISED" }, { status: 403 });
    await logAction(session.userId, "SESSION_COMPROMISED", "User", session.userId, { deviceId: session.deviceId, uaMismatch: { stored: session.userAgentFamily, current: currentUAFamily } }, ip);
    return clearAuthCookies(res);
  }

  // Normal flow: blacklist old token with 2-min grace, rotate tokens
  const gracePeriodMs = 2 * 60 * 1000;
  const expiresInMs = (session.expiresAt.getTime() - Date.now());
  await blacklistToken(tokenHash, session.userId, gracePeriodMs, expiresInMs);

  const newRefreshToken = generateRefreshToken();
  const newAccessToken = generateAccessToken(session.userId, session.user.role);
  const newTokenHash = hashToken(newRefreshToken);

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshToken: newTokenHash,
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000),
    },
  });

  const res = NextResponse.json({ data: { user: { id: session.user.id, role: session.user.role } } });
  return setAuthCookies(res, newRefreshToken, newAccessToken);
});

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { clearAuthCookies, getCookie } from "@/lib/auth-helpers";
import { blacklistToken } from "@/lib/redis";
import { hashToken, ACCESS_TOKEN_EXPIRY_SECONDS } from "@/lib/tokens";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id")!;
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  const refreshToken = getCookie(req, "refresh_token");
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await blacklistToken(tokenHash, userId, 0, ACCESS_TOKEN_EXPIRY_SECONDS * 1000);
  }

  await prisma.session.deleteMany({ where: { userId } });

  await logAction(userId, "LOGOUT_ALL", "User", userId, null, ip);

  const res = NextResponse.json({ data: { success: true } });
  return clearAuthCookies(res);
});

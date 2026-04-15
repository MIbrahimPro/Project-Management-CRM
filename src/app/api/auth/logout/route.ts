import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { blacklistToken } from "@/lib/redis";
import { hashToken, ACCESS_TOKEN_EXPIRY_SECONDS } from "@/lib/tokens";
import { clearAuthCookies, getCookie } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  const headerUserId = req.headers.get("x-user-id");
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  const refreshToken = getCookie(req, "refresh_token");
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    const session = await prisma.session.findUnique({
      where: { refreshToken: tokenHash },
      select: { userId: true },
    });
    const effectiveUserId = headerUserId ?? session?.userId;

    if (effectiveUserId) {
      await prisma.session.deleteMany({ where: { userId: effectiveUserId, refreshToken: tokenHash } });
      await blacklistToken(tokenHash, effectiveUserId, 0, ACCESS_TOKEN_EXPIRY_SECONDS * 1000);
      await logAction(effectiveUserId, "LOGOUT", "User", effectiveUserId, null, ip);
    } else {
      await prisma.session.deleteMany({ where: { refreshToken: tokenHash } });
    }
  }

  const res = NextResponse.json({ data: { success: true } });
  return clearAuthCookies(res);
});

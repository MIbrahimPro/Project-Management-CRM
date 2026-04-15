import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { checkRateLimit, incrementOtpAttempts, blockOtpUser, clearOtpAttempts, isOtpBlocked } from "@/lib/redis";
import { REFRESH_TOKEN_SECRET } from "@/lib/tokens";
import { getCookie, setFlowCookie, clearFlowCookies } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

const VerifyOtpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const allowed = await checkRateLimit(`verify_otp:${ip}`, 10, 900);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts", code: "RATE_LIMITED" }, { status: 429 });
  }

  const otpFlowCookie = getCookie(req, "otp_flow");
  if (!otpFlowCookie) {
    return NextResponse.json({ error: "Session expired. Request a new code.", code: "SESSION_EXPIRED" }, { status: 401 });
  }

  let payload: { userId: string } | null = null;
  try {
    payload = jwt.verify(otpFlowCookie, REFRESH_TOKEN_SECRET) as { userId: string };
  } catch {
    return NextResponse.json({ error: "Session expired. Request a new code.", code: "SESSION_EXPIRED" }, { status: 401 });
  }

  if (await isOtpBlocked(payload.userId)) {
    return NextResponse.json({ error: "Too many failed attempts. Please try again later.", code: "OTP_BLOCKED" }, { status: 429 });
  }

  const body = VerifyOtpSchema.parse(await req.json());

  const otpRecord = await prisma.otpToken.findFirst({
    where: { userId: payload.userId, purpose: "password_reset", used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    await incrementOtpAttempts(payload.userId);
    return NextResponse.json({ error: "Invalid or expired code", code: "INVALID_OTP" }, { status: 400 });
  }

  const valid = await bcrypt.compare(body.otp, otpRecord.otpHash);
  if (!valid) {
    const attempts = await incrementOtpAttempts(payload.userId);
    const maxAttemptsConfig = await prisma.systemConfig.findUnique({ where: { key: "otp_max_attempts" } });
    const maxAttempts = parseInt(maxAttemptsConfig?.value || "5");
    if (attempts >= maxAttempts) {
      const blockConfig = await prisma.systemConfig.findUnique({ where: { key: "otp_block_minutes" } });
      const blockMinutes = parseInt(blockConfig?.value || "30");
      await blockOtpUser(payload.userId, blockMinutes);
      return NextResponse.json({ error: `Too many failed attempts. Blocked for ${blockMinutes} minutes.`, code: "OTP_BLOCKED" }, { status: 429 });
    }
    return NextResponse.json({ error: "Invalid or expired code", code: "INVALID_OTP" }, { status: 400 });
  }

  await prisma.otpToken.update({ where: { id: otpRecord.id }, data: { used: true } });
  await clearOtpAttempts(payload.userId);

  const resetFlowToken = jwt.sign({ userId: payload.userId }, REFRESH_TOKEN_SECRET, { expiresIn: "15m" });
  const res = NextResponse.json({ data: { success: true } });
  clearFlowCookies(res);
  setFlowCookie(res, "reset_flow", resetFlowToken);
  return res;
});

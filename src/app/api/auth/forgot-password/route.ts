import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { checkRateLimit } from "@/lib/redis";
import { REFRESH_TOKEN_SECRET } from "@/lib/tokens";
import { setFlowCookie } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

const ForgotSchema = z.object({
  email: z.string().email("Invalid email format"),
});

const resend = new Resend(process.env.RESEND_API_KEY);

export const POST = apiHandler(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const allowed = await checkRateLimit(`forgot:${ip}`, 5, 3600);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts", code: "RATE_LIMITED" }, { status: 429 });
  }

  const body = ForgotSchema.parse(await req.json());

  const user = await prisma.user.findUnique({
    where: { email: body.email },
    select: { id: true, name: true, email: true, isGoogleConnected: true, passwordHash: true },
  });

  const GENERIC_SUCCESS = { data: { success: true, message: "If this email is registered, you will receive a code." } };

  if (!user || (user.isGoogleConnected && !user.passwordHash)) {
    return NextResponse.json(GENERIC_SUCCESS);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);

  await prisma.otpToken.create({
    data: {
      userId: user.id,
      otpHash,
      purpose: "password_reset",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const otpFlowToken = jwt.sign({ userId: user.id }, REFRESH_TOKEN_SECRET, { expiresIn: "15m" });

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to: user.email,
    subject: "Your DevRolin Password Reset Code",
    html: `<p>Hi ${user.name},</p><p>Your 6-digit code is: <strong style="font-size:24px;letter-spacing:4px;">${otp}</strong></p><p>It expires in 10 minutes. If you did not request this, ignore this email.</p>`,
  });

  const res = NextResponse.json(GENERIC_SUCCESS);
  setFlowCookie(res, "otp_flow", otpFlowToken);
  return res;
});

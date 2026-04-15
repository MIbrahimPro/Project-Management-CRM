import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { getCookie } from "@/lib/auth-helpers";
import jwt from "jsonwebtoken";
import { REFRESH_TOKEN_SECRET } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const otpFlowCookie = getCookie(req, "otp_flow");
  if (!otpFlowCookie) {
    return NextResponse.json({ error: "No active OTP session", code: "SESSION_EXPIRED" }, { status: 401 });
  }

  try {
    jwt.verify(otpFlowCookie, REFRESH_TOKEN_SECRET);
    return NextResponse.json({ data: { valid: true } });
  } catch {
    return NextResponse.json({ error: "OTP session expired", code: "SESSION_EXPIRED" }, { status: 401 });
  }
});

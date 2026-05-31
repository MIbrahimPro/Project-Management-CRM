import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/api-handler";
import { getCookie } from "@/lib/auth/auth-helpers";
import jwt from "jsonwebtoken";
import { REFRESH_TOKEN_SECRET } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const resetFlowCookie = getCookie(req, "reset_flow");
  if (!resetFlowCookie) {
    return NextResponse.json({ error: "No active reset session", code: "SESSION_EXPIRED" }, { status: 401 });
  }

  try {
    jwt.verify(resetFlowCookie, REFRESH_TOKEN_SECRET);
    return NextResponse.json({ data: { valid: true } });
  } catch {
    return NextResponse.json({ error: "Reset session expired", code: "SESSION_EXPIRED" }, { status: 401 });
  }
});

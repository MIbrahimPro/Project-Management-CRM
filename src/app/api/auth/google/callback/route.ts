import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/**
 * Fetch wrapper with timeout to avoid hanging OAuth callbacks.
 */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const appOrigin = new URL(req.url).origin;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/login?error=google_denied", req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=google_invalid", req.url));
  }

  let statePayload: { flow: string } | null = null;
  try {
    statePayload = jwt.verify(state, process.env.REFRESH_TOKEN_SECRET!) as { flow: string };
  } catch {
    return NextResponse.redirect(new URL("/login?error=google_csrf", req.url));
  }

  let tokenRes: Response;
  try {
    tokenRes = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appOrigin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
  } catch {
    return NextResponse.redirect(new URL("/login?error=google_timeout", req.url));
  }

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/login?error=google_token", req.url));
  }

  const tokenData = await tokenRes.json();
  let userInfoRes: Response;
  try {
    userInfoRes = await fetchWithTimeout("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
  } catch {
    return NextResponse.redirect(new URL("/login?error=google_timeout", req.url));
  }

  if (!userInfoRes.ok) {
    return NextResponse.redirect(new URL("/login?error=google_userinfo", req.url));
  }

  const googleUser = await userInfoRes.json();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (statePayload.flow === "connect") {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    }
  }

  let loginRes: Response;
  try {
    loginRes = await fetchWithTimeout(`${appOrigin}/api/auth/google`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        code,
        flow: statePayload.flow,
        googleUser,
        googleRefreshToken: tokenData.refresh_token || null,
      }),
    }, 90000);
  } catch {
    const redirectUrl = statePayload.flow === "connect"
      ? "/settings?highlight=google-connect&error=timeout"
      : "/login?error=google_timeout";
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  }

  await loginRes.json().catch(() => null);

  if (!loginRes.ok) {
    const redirectUrl = statePayload.flow === "connect"
      ? "/settings?highlight=google-connect&error=failed"
      : "/login?error=google_no_account";
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  }

  const redirectUrl = statePayload.flow === "connect"
    ? "/settings?highlight=google-connect&connected=true"
    : "/dashboard";
  return NextResponse.redirect(new URL(redirectUrl, req.url));
});

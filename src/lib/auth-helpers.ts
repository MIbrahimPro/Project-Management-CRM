import { NextRequest, NextResponse } from "next/server";
import { serialize, parse } from "cookie";
import { REFRESH_TOKEN_EXPIRY_SECONDS, ACCESS_TOKEN_EXPIRY_SECONDS } from "./tokens";

const SECURE = process.env.NODE_ENV === "production";
const SAME_SITE = "strict" as const;

export function setAuthCookies(res: NextResponse, refreshToken: string, accessToken: string): NextResponse {
  // path: "/" so the browser sends refresh_token on navigations — middleware can
  // call POST /api/auth/refresh before RSC runs (narrow path hid the cookie from GET /dashboard).
  res.headers.append("Set-Cookie", serialize("refresh_token", refreshToken, {
    httpOnly: true, secure: SECURE, sameSite: SAME_SITE,
    path: "/",
    maxAge: REFRESH_TOKEN_EXPIRY_SECONDS,
  }));
  res.headers.append("Set-Cookie", serialize("access_token", accessToken, {
    httpOnly: true, secure: SECURE, sameSite: SAME_SITE,
    path: "/",
    maxAge: ACCESS_TOKEN_EXPIRY_SECONDS,
  }));
  // Cleanup legacy path-scoped refresh cookie from older builds.
  res.headers.append("Set-Cookie", serialize("refresh_token", "", {
    httpOnly: true, secure: SECURE, sameSite: SAME_SITE,
    path: "/api/auth/refresh",
    maxAge: 0,
  }));
  return res;
}

export function clearAuthCookies(res: NextResponse): NextResponse {
  res.headers.append("Set-Cookie", serialize("refresh_token", "", {
    httpOnly: true, secure: SECURE, sameSite: SAME_SITE,
    path: "/", maxAge: 0,
  }));
  res.headers.append("Set-Cookie", serialize("access_token", "", {
    httpOnly: true, secure: SECURE, sameSite: SAME_SITE,
    path: "/", maxAge: 0,
  }));
  // Also clear legacy refresh cookie path to avoid duplicate-name collisions.
  res.headers.append("Set-Cookie", serialize("refresh_token", "", {
    httpOnly: true, secure: SECURE, sameSite: SAME_SITE,
    path: "/api/auth/refresh", maxAge: 0,
  }));
  return res;
}

export function setFlowCookie(res: NextResponse, name: "otp_flow" | "reset_flow", value: string): NextResponse {
  res.headers.append("Set-Cookie", serialize(name, value, {
    httpOnly: true, secure: SECURE, sameSite: SAME_SITE,
    path: "/", maxAge: 15 * 60,
  }));
  return res;
}

export function clearFlowCookies(res: NextResponse): NextResponse {
  ["otp_flow", "reset_flow"].forEach(name => {
    res.headers.append("Set-Cookie", serialize(name, "", {
      httpOnly: true, secure: SECURE, sameSite: SAME_SITE, path: "/", maxAge: 0,
    }));
  });
  return res;
}

export function getCookie(req: NextRequest, name: string): string | undefined {
  const raw = req.headers.get("cookie") || "";
  // Prefer the last occurrence to handle duplicate cookie names from legacy paths.
  const parts = raw.split(";").map((p) => p.trim());
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (!part) continue;
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    if (key !== name) continue;
    const value = part.slice(eqIndex + 1);
    return value;
  }
  const cookies = parse(raw);
  return cookies[name];
}

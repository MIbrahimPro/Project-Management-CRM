import { NextRequest, NextResponse } from "next/server";
import { parse } from "cookie";
import type { AccessTokenPayload } from "@/lib/tokens";
import { verifyAccessTokenEdge } from "@/lib/tokens-edge";
import { tryRefreshSession } from "@/lib/middleware-refresh";

const PUBLIC_ROUTES = [
  "/login", "/forgot-password", "/otp", "/reset-password",
  "/invite", "/careers", "/install", "/offline",
  "/join/meeting",
  "/api/auth/login", "/api/auth/google", "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/forgot-password", "/api/auth/verify-otp", "/api/auth/reset-password",
  "/api/auth/google/init", "/api/auth/google/callback",
  "/api/invite/accept", "/api/public", "/api/meetings/external-api",
];

const SUPER_ADMIN_ROUTES = ["/control", "/api/super-admin"];

/**
 * Resolves the current user from access_token, or refreshes via refresh_token
 * (HttpOnly, path /) and returns updated request cookies + Set-Cookie lines.
 */
async function resolveAuth(req: NextRequest): Promise<{
  payload: AccessTokenPayload;
  requestHeaders: Headers;
  setCookieHeaders: string[];
} | null> {
  const cookies = parse(req.headers.get("cookie") || "");
  let payload = cookies.access_token
    ? await verifyAccessTokenEdge(cookies.access_token)
    : null;

  let cookieHeader = req.headers.get("cookie") ?? "";
  const setCookieHeaders: string[] = [];

  if (!payload) {
    const refreshed = await tryRefreshSession(req);
    if (!refreshed) return null;
    payload = refreshed.payload;
    cookieHeader = refreshed.requestCookieHeader;
    setCookieHeaders.push(...refreshed.setCookieHeaders);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("cookie", cookieHeader);
  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-user-role", payload.role);

  return { payload, requestHeaders, setCookieHeaders };
}

function withSetCookies(res: NextResponse, setCookieHeaders: string[]): NextResponse {
  for (const line of setCookieHeaders) {
    res.headers.append("Set-Cookie", line);
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestCookies = parse(req.headers.get("cookie") || "");
  const hasAuthCookies = Boolean(requestCookies.access_token || requestCookies.refresh_token);

  const isGuestJoinTokenRequest =
    pathname.startsWith("/api/meetings/") &&
    pathname.endsWith("/join-token") &&
    req.nextUrl.searchParams.get("guest") === "1";

  if (isGuestJoinTokenRequest && !hasAuthCookies) {
    return NextResponse.next();
  }

  // Static assets — skip immediately
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js"
  ) {
    return NextResponse.next();
  }

  // Super-admin routes — 404 for everyone else (security through obscurity)
  if (SUPER_ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    const auth = await resolveAuth(req);
    if (!auth || auth.payload.role !== "SUPER_ADMIN") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.rewrite(new URL("/not-found", req.url));
    }
    const res = NextResponse.next({ request: { headers: auth.requestHeaders } });
    return withSetCookies(res, auth.setCookieHeaders);
  }

  // Public routes — pass through
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Protected routes — verify or refresh session
  const auth = await resolveAuth(req);
  if (!auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const res = NextResponse.next({ request: { headers: auth.requestHeaders } });
  return withSetCookies(res, auth.setCookieHeaders);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

/**
 * Edge middleware helpers: refresh an expired access token using the HttpOnly
 * refresh cookie, then merge new cookies into the forwarded request and echo
 * Set-Cookie to the browser so the session stays in sync.
 */
import { parse } from "cookie";
import type { NextRequest } from "next/server";
import type { AccessTokenPayload } from "./tokens";
import { verifyAccessTokenEdge } from "./tokens-edge";

/**
 * Applies Set-Cookie header lines onto an incoming Cookie header value so
 * downstream handlers see the updated session for this request.
 */
export function mergeCookiesFromSetCookie(
  requestCookieHeader: string,
  setCookieHeaders: string[]
): string {
  const jar = parse(requestCookieHeader);
  for (const sc of setCookieHeaders) {
    const [pair] = sc.split(";");
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const lower = sc.toLowerCase();
    if (lower.includes("max-age=0")) {
      delete jar[name];
    } else {
      jar[name] = value;
    }
  }
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function getSetCookieLines(res: Response): string[] {
  const lines = res.headers.getSetCookie?.();
  if (lines && lines.length > 0) return lines;
  const single = res.headers.get("set-cookie");
  return single ? splitCombinedSetCookie(single) : [];
}

/**
 * Some runtimes expose multiple Set-Cookie headers as one comma-delimited
 * header string. This splitter keeps Expires=... commas intact.
 */
function splitCombinedSetCookie(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let inExpires = false;

  for (let i = 0; i < value.length; i++) {
    const segment = value.slice(i, i + 8).toLowerCase();
    if (!inExpires && segment === "expires=") {
      inExpires = true;
      continue;
    }
    if (inExpires && value[i] === ";") {
      inExpires = false;
      continue;
    }
    if (inExpires || value[i] !== ",") continue;

    const rest = value.slice(i + 1);
    const isCookieBoundary = /^\s*([!#$%&'*+\-.^_`|~0-9A-Za-z]+)=/.test(rest);
    if (!isCookieBoundary) continue;

    const cookieLine = value.slice(start, i).trim();
    if (cookieLine) parts.push(cookieLine);
    start = i + 1;
  }

  const tail = value.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

/**
 * Calls POST /api/auth/refresh with the incoming cookies. Returns new payload
 * and cookie strings if refresh succeeded.
 */
export async function tryRefreshSession(req: NextRequest): Promise<{
  payload: AccessTokenPayload;
  requestCookieHeader: string;
  setCookieHeaders: string[];
} | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = parse(cookieHeader);
  if (!cookies.refresh_token) return null;

  let refreshRes: Response;
  try {
    const refreshUrl = new URL("/api/auth/refresh", req.url);
    // Node fetch may resolve localhost to ::1, but dev server often only binds 127.0.0.1.
    if (refreshUrl.hostname === "localhost") {
      refreshUrl.hostname = "127.0.0.1";
    }
    refreshRes = await fetch(refreshUrl.toString(), {
      method: "POST",
      headers: {
        cookie: cookieHeader,
        "user-agent": req.headers.get("user-agent") ?? "",
        "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
      },
      cache: "no-store",
    });
  } catch (err) {
    // Don't throw from middleware — treat refresh failure as unauthenticated.
    // Log for diagnostics; middleware consumers will handle null result.
    // eslint-disable-next-line no-console
    console.error("[middleware-refresh] fetch /api/auth/refresh failed:", err);
    return null;
  }

  if (!refreshRes.ok) return null;

  const setCookieHeaders = getSetCookieLines(refreshRes);
  if (setCookieHeaders.length === 0) return null;

  const mergedHeader = mergeCookiesFromSetCookie(cookieHeader, setCookieHeaders);
  const mergedCookies = parse(mergedHeader);
  const newAccess = mergedCookies.access_token;
  if (!newAccess) return null;

  const payload = await verifyAccessTokenEdge(newAccess);
  if (!payload) return null;

  return {
    payload,
    requestCookieHeader: mergedHeader,
    setCookieHeaders,
  };
}

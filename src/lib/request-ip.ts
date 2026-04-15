import { NextRequest } from "next/server";

/**
 * Extracts the most reliable client IP address from request headers.
 * Falls back to "unknown" if no trusted header is present.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp?.trim()) return cfIp.trim();

  const trueClientIp = req.headers.get("true-client-ip");
  if (trueClientIp?.trim()) return trueClientIp.trim();

  return "unknown";
}

/**
 * Returns a stable, per-client key for rate limiting.
 * Uses client IP when available, else falls back to user-agent.
 */
export function getRateLimitClientKey(req: NextRequest): string {
  const ip = getClientIp(req);
  if (ip !== "unknown") {
    return `ip:${ip}`;
  }

  const userAgent = req.headers.get("user-agent")?.trim() || "unknown";
  return `ua:${userAgent.slice(0, 120)}`;
}

import { checkRateLimit } from "./redis";
import { NextRequest, NextResponse } from "next/server";
import { getRateLimitClientKey } from "./request-ip";

export async function rateLimiter(
  req: NextRequest,
  identifier: string,
  maxRequests: number = 10,
  windowSeconds: number = 900
): Promise<NextResponse | null> {
  const key = `${identifier}:${getRateLimitClientKey(req)}`;
  const allowed = await checkRateLimit(key, maxRequests, windowSeconds);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": windowSeconds.toString() } }
    );
  }
  return null;
}

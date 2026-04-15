/**
 * Edge-compatible JWT verification using `jose`.
 * Use this in src/middleware.ts (Edge Runtime).
 * Use jsonwebtoken-based helpers in API routes and server components (Node.js).
 */
import { jwtVerify } from "jose";
import type { AccessTokenPayload } from "./tokens";

function getSecret(): Uint8Array {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) throw new Error("ACCESS_TOKEN_SECRET not set");
  return new TextEncoder().encode(secret);
}

export async function verifyAccessTokenEdge(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as AccessTokenPayload;
  } catch {
    return null;
  }
}

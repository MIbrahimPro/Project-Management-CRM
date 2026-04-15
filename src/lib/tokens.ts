import jwt from "jsonwebtoken";
import crypto from "crypto";

export const ACCESS_TOKEN_EXPIRY_SECONDS = 30 * 60;
export const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
export const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

export interface AccessTokenPayload {
  userId: string;
  role: string;
  iat: number;
  exp: number;
}

export function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, process.env.ACCESS_TOKEN_SECRET!, {
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
  });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function generateDeviceId(): string {
  return crypto.randomUUID();
}

export function parseUserAgentFamily(userAgent: string): "Mobile" | "Desktop" | "Tablet" {
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/.test(ua)) return "Tablet";
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/.test(ua)) return "Mobile";
  return "Desktop";
}

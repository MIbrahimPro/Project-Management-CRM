import jwt from "jsonwebtoken";

const RAW_JITSI_DOMAIN = process.env.JITSI_DOMAIN ?? "meet.jit.si";
const JITSI_APP_ID = process.env.JITSI_APP_ID ?? "devrolin";
const JITSI_APP_SECRET = process.env.JITSI_APP_SECRET ?? "";

export interface JitsiUser {
  id: string;
  name: string;
  isModerator: boolean;
}

function normalizeDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "meet.jit.si";
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, "");
  return withoutProtocol.replace(/\/+$/, "");
}

function shouldUseJwt(domain: string): boolean {
  const isPublicJitsi = domain.toLowerCase() === "meet.jit.si";
  return !isPublicJitsi && Boolean(JITSI_APP_SECRET);
}

export function generateJitsiToken(roomName: string, user: JitsiUser): string | null {
  const domain = normalizeDomain(RAW_JITSI_DOMAIN);
  if (!shouldUseJwt(domain)) return null;

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    context: {
      user: {
        id: user.id,
        name: user.name,
        affiliation: user.isModerator ? "owner" : "member",
      },
      features: {
        recording: user.isModerator,
        "live-streaming": false,
        "outbound-call": false,
      },
    },
    aud: "jitsi",
    iss: JITSI_APP_ID,
    sub: domain,
    room: roomName,
    iat: now,
    exp: now + 60 * 60 * 4, // 4 hours
  };

  return jwt.sign(payload, JITSI_APP_SECRET, { algorithm: "HS256" });
}

export function getJitsiDomain(): string {
  return normalizeDomain(RAW_JITSI_DOMAIN);
}

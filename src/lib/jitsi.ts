import jwt from "jsonwebtoken";

const DEFAULT_JITSI_DOMAIN = "meet.jit.si";
const RAW_JITSI_DOMAIN = process.env.JITSI_DOMAIN ?? "";
const RAW_JITSI_SERVER_URL = process.env.JITSI_SERVER_URL ?? "";
const JITSI_APP_ID = process.env.JITSI_APP_ID ?? "devrolin";
const JITSI_APP_SECRET = process.env.JITSI_APP_SECRET ?? "";

function splitHostAndPort(value: string): string {
  return value.replace(/^\[/, "").replace(/\]$/, "").split(":")[0] ?? value;
}

function isValidJitsiHost(host: string): boolean {
  const normalizedHost = splitHostAndPort(host.trim().toLowerCase());
  if (!normalizedHost) return false;
  if (normalizedHost === "localhost") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalizedHost)) return true;
  if (normalizedHost.includes(".")) return true;
  // Allow IPv6 host format.
  if (normalizedHost.includes(":")) return true;
  return false;
}

function defaultProtocolForHost(host: string): "http" | "https" {
  return splitHostAndPort(host).toLowerCase() === "localhost" ? "http" : "https";
}

export interface JitsiUser {
  id: string;
  name: string;
  isModerator: boolean;
}

function normalizeDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_JITSI_DOMAIN;

  let candidateHost = "";

  try {
    const parsed = new URL(trimmed);
    candidateHost = parsed.host;
  } catch {
    // Fall back to host-only input.
  }

  if (!candidateHost) {
    const withoutProtocol = trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    candidateHost = withoutProtocol.split("/")[0] ?? "";
  }

  return isValidJitsiHost(candidateHost) ? candidateHost : DEFAULT_JITSI_DOMAIN;
}

function normalizeServerUrl(input: string, fallbackDomain: string): string {
  const fallbackProtocol = defaultProtocolForHost(fallbackDomain);
  const fallbackUrl = `${fallbackProtocol}://${fallbackDomain}`;
  const trimmed = input.trim();
  if (!trimmed) return fallbackUrl;

  try {
    const parsed = new URL(trimmed);
    if (!isValidJitsiHost(parsed.host)) return fallbackUrl;
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    const withoutProtocol = trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const host = withoutProtocol.split("/")[0] ?? "";
    if (!isValidJitsiHost(host)) return fallbackUrl;
    const protocol = defaultProtocolForHost(host);
    return `${protocol}://${withoutProtocol}`;
  }
}

function getJitsiConfig() {
  const domainSource = RAW_JITSI_DOMAIN.trim() || RAW_JITSI_SERVER_URL.trim() || DEFAULT_JITSI_DOMAIN;
  const domain = normalizeDomain(domainSource);
  const serverUrl = normalizeServerUrl(RAW_JITSI_SERVER_URL, domain);
  return { domain, serverUrl };
}

function shouldUseJwt(domain: string): boolean {
  const isPublicJitsi = domain.toLowerCase() === "meet.jit.si";
  return !isPublicJitsi && Boolean(JITSI_APP_SECRET);
}

// Jitsi JWT lifetime — long enough for all-day meetings and to tolerate
// page-open times > the old 4h limit. Bound to a single room so extending
// this is safe (token is useless outside the specified room).
const JITSI_TOKEN_LIFETIME_SECONDS = 60 * 60 * 12; // 12 hours
const JITSI_CLOCK_SKEW_SECONDS = 60; // tolerate ±60s between server and Prosody

export function generateJitsiToken(roomName: string, user: JitsiUser): string | null {
  const { domain } = getJitsiConfig();
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
    // Set `iat`/`nbf` slightly in the past so clock skew between the Next.js
    // server and the Prosody/Jitsi host doesn't trip the `nbf` check.
    iat: now - JITSI_CLOCK_SKEW_SECONDS,
    nbf: now - JITSI_CLOCK_SKEW_SECONDS,
    exp: now + JITSI_TOKEN_LIFETIME_SECONDS,
  };

  return jwt.sign(payload, JITSI_APP_SECRET, { algorithm: "HS256" });
}

export function getJitsiDomain(): string {
  return getJitsiConfig().domain;
}

export function getJitsiServerUrl(): string {
  return getJitsiConfig().serverUrl;
}

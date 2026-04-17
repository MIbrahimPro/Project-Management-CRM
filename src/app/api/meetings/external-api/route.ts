import { NextRequest, NextResponse } from "next/server";
import { getJitsiServerUrl } from "@/lib/jitsi";

export const dynamic = "force-dynamic";

function normalizeServerUrl(input: string | null): string {
  const fallback = getJitsiServerUrl();
  const trimmed = input?.trim();
  if (!trimmed) return fallback;

  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return fallback;
  }
}

function sanitizeExternalApiScript(source: string): string {
  return source.replace(/,\s*"speaker-selection"/g, "");
}

export async function GET(req: NextRequest) {
  const serverUrl = normalizeServerUrl(req.nextUrl.searchParams.get("serverUrl"));
  const upstreamUrl = `${serverUrl}/external_api.js`;

  try {
    const upstream = await fetch(upstreamUrl, { cache: "no-store" });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Failed to load Jitsi external API script" },
        { status: 502 }
      );
    }

    const source = await upstream.text();
    const sanitized = sanitizeExternalApiScript(source);

    return new NextResponse(sanitized, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to proxy Jitsi external API script" },
      { status: 502 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const flow = searchParams.get("flow") || "login";
  const appOrigin = new URL(req.url).origin;

  const state = jwt.sign({ flow }, process.env.REFRESH_TOKEN_SECRET!, { expiresIn: "10m" });

  const scope = flow === "connect"
    ? "email profile https://www.googleapis.com/auth/drive.file"
    : "email profile";

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${appOrigin}/api/auth/google/callback`,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.json({ data: { url } });
});

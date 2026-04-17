import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { getSignedUrl } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  void userId; // just verifies authentication

  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const signedUrl = await getSignedUrl(path, 3600); // 1-hour URL
  if (!signedUrl) {
    console.error(`[SignedURL] Failed to generate for path: ${path}`);
  }
  return NextResponse.json({ url: signedUrl });
});

import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { getSignedUrl } from "@/lib/storage/supabase-storage";

export const dynamic = "force-dynamic";

// Extract storage path from various URL formats
function extractStoragePath(input: string): string | null {
  // Already a storage path
  if (
    input.startsWith("profile-pics/") ||
    input.startsWith("chat-media/") ||
    input.startsWith("workspace-task-media/") ||
    input.startsWith("photos/") ||
    input.startsWith("cv-files/") ||
    input.startsWith("project-pdfs/") ||
    input.startsWith("receipts/") ||
    input.startsWith("recordings/") ||
    input.startsWith("contracts/")
  ) {
    return input;
  }

  // Extract from Supabase signed URL
  try {
    const url = new URL(input);
    const marker = "/devrolin-files/";
    const idx = url.pathname.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(url.pathname.slice(idx + marker.length)).split("?")[0];
    }
  } catch {
    // Not a valid URL, use as-is if it's a path-like string
    if (input.includes("/")) {
      return input;
    }
  }

  return null;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  void userId; // just verifies authentication

  const url = new URL(req.url);
  const rawPath = url.searchParams.get("path");
  if (!rawPath) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const path = extractStoragePath(rawPath);
  if (!path) {
    return NextResponse.json({ error: "Invalid path format" }, { status: 400 });
  }

  const signedUrl = await getSignedUrl(path, 3600); // 1-hour URL
  if (!signedUrl) {
    console.error(`[SignedURL] Failed to generate for path: ${path}`);
  }
  return NextResponse.json({ url: signedUrl });
});

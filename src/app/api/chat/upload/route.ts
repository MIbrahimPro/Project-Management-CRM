import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { uploadFile, getSignedUrl } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

const MAX_SIZES: Record<string, number> = {
  image: 10 * 1024 * 1024,    // 10 MB
  video: 20 * 1024 * 1024,    // 20 MB
  document: 20 * 1024 * 1024, // 20 MB
  voice: 5 * 1024 * 1024,     // 5 MB
  gif: 5 * 1024 * 1024,       // 5 MB
};

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();

  const formData = await req.formData();
  const file = formData.get("file");
  const type = (formData.get("type") as string | null) ?? "document";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const maxSize = MAX_SIZES[type] ?? MAX_SIZES.document;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `File too large (max ${maxSize / 1024 / 1024}MB)` },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `chat-media/${userId}-${Date.now()}.${ext}` as const;
  const buffer = Buffer.from(await file.arrayBuffer());

  await uploadFile(buffer, path, file.type);

  // Return a 24-hour signed URL for immediate display
  const signedUrl = await getSignedUrl(path, 24 * 3600);

  return NextResponse.json({ data: { path, signedUrl, type } });
});

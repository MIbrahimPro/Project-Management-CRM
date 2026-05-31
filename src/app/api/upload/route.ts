import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { uploadFile, getSignedUrl } from "@/lib/storage/supabase-storage";

export const dynamic = "force-dynamic";

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();

  const formData = await req.formData();
  const file = formData.get("file");
  const folder = (formData.get("folder") as string | null) ?? "project-assets";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_SIZE / 1024 / 1024}MB)` },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${folder}/${userId}-${Date.now()}.${ext}` as `project-assets/${string}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await uploadFile(buffer, path, file.type);

  // Return a 24-hour signed URL for immediate display
  const signedUrl = await getSignedUrl(path, 24 * 3600);

  return NextResponse.json({ data: { path, url: signedUrl } });
});

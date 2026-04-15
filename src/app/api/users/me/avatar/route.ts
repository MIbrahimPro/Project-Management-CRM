import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { deleteFile, getSignedUrl, uploadFile } from "@/lib/supabase-storage";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function extractProfileStoragePath(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("profile-pics/")) return value;

  try {
    const url = new URL(value);
    const marker = "/devrolin-files/";
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;
    const objectPath = decodeURIComponent(url.pathname.slice(idx + marker.length));
    return objectPath.startsWith("profile-pics/") ? objectPath : null;
  } catch {
    return null;
  }
}

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  const form = await req.formData();
  const file = form.get("avatar");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Avatar file is required", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type", code: "UNSUPPORTED_FILE_TYPE" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Image exceeds 5MB limit", code: "FILE_TOO_LARGE" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);
  const jpegBuffer = await sharp(inputBuffer).jpeg({ quality: 90 }).toBuffer();

  const storagePath = `profile-pics/${userId}-${Date.now()}.jpg` as const;
  await uploadFile(jpegBuffer, storagePath, "image/jpeg");

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, profilePicUrl: true },
  });

  if (!existingUser) {
    return NextResponse.json(
      { error: "User not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const oldPath = extractProfileStoragePath(existingUser.profilePicUrl);
  if (oldPath && oldPath !== storagePath) {
    await deleteFile(oldPath);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { profilePicUrl: storagePath },
  });

  const signedUrl = await getSignedUrl(storagePath, 3600);

  await logAction(
    userId,
    "PROFILE_AVATAR_UPDATED",
    "User",
    userId,
    { storagePath },
    ip
  );

  return NextResponse.json({
    data: {
      profilePicUrl: storagePath,
      avatarSignedUrl: signedUrl,
    },
  });
});

import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const POST = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meetingId = ctx?.params?.id;
  if (!meetingId) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const formData = await req.json();
  const { blobPath, title } = formData;

  if (!blobPath) return NextResponse.json({ error: "Missing recording data" }, { status: 400 });

  // Update meeting with recording URL
  // Note: The actual file upload is handled by the client directly to storage-api
  // OR we receive the path here if the client used /api/chat/upload.
  
  await prisma.meetingRecording.create({
    data: {
      meetingId,
      storagePath: blobPath,
      uploadedById: userId,
      title: title || "Meeting Recording",
    },
  });

  await logAction(userId, "CREATE", "MeetingRecording", meetingId, { storagePath: blobPath });

  return NextResponse.json({ success: true });
});

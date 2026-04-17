import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";
import { z } from "zod";

const recordingSchema = z.object({
  meetingId: z.string(),
  title: z.string().optional(),
  storagePath: z.string(),
  sizeBytes: z.number().optional(),
  durationSec: z.number().optional(),
  uploadedById: z.string(),
});

export const POST = apiHandler(async (req: NextRequest) => {
  // This endpoint might need a shared secret or specific auth if hit by an external service (e.g. Jibri)
  // For now, we'll assume it's hit by a trusted service or internal process.
  
  const body = recordingSchema.parse(await req.json());

  const recording = await prisma.meetingRecording.create({
    data: {
      meetingId: body.meetingId,
      title: body.title,
      storagePath: body.storagePath,
      sizeBytes: body.sizeBytes ? BigInt(body.sizeBytes) : null,
      durationSec: body.durationSec,
      uploadedById: body.uploadedById,
    },
  });

  await logAction(body.uploadedById, "MEETING_RECORDING_UPLOADED", "MeetingRecording", recording.id, {
    meetingId: body.meetingId,
  });

  return NextResponse.json({ data: recording });
});

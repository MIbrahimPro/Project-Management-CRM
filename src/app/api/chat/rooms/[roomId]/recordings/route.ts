import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest, { params }: any) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const { roomId } = params;

  // Check if user is a member of the room
  const membership = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (!membership) {
    return forbidden();
  }

  const recordings = await prisma.meetingRecording.findMany({
    where: {
      meeting: {
        chatRoomId: roomId,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      storagePath: true,
      sizeBytes: true,
      durationSec: true,
      createdAt: true,
      uploadedBy: {
        select: { name: true },
      },
    },
  });

  return NextResponse.json({ data: recordings });
});

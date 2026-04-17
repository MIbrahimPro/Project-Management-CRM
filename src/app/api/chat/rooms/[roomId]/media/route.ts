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

  const media = await prisma.message.findMany({
    where: {
      roomId,
      mediaUrl: { not: null },
      mediaType: { in: ["image", "video", "voice", "document"] },
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      mediaUrl: true,
      mediaType: true,
      createdAt: true,
      sender: {
        select: { name: true },
      },
    },
  });

  return NextResponse.json({ data: media });
});

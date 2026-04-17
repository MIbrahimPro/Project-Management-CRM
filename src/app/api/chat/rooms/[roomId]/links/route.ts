import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Regex to find URLs
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

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

  // Find messages with URLs in content
  const messages = await prisma.message.findMany({
    where: {
      roomId,
      content: { contains: "http" },
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      sender: {
        select: { name: true },
      },
    },
  });

  // Extract all URLs from messages
  const links = messages.flatMap((m) => {
    const urls = m.content?.match(URL_REGEX) || [];
    return urls.map((url) => ({
      id: m.id,
      url,
      sender: m.sender,
      createdAt: m.createdAt,
    }));
  });

  return NextResponse.json({ data: links });
});

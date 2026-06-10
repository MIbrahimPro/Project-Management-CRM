import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export const GET = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const roomId = ctx?.params.roomId;
    if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

    const member = await prisma.chatRoomMember.findFirst({
      where: { roomId, userId, room: { deletedAt: null } },
      select: { id: true },
    });
    if (!member) forbidden();

    const messages = await prisma.message.findMany({
      where: { roomId, pinnedAt: { not: null }, deletedAt: null },
      orderBy: { pinnedAt: "desc" },
      select: {
        id: true,
        content: true,
        mediaType: true,
        createdAt: true,
        pinnedAt: true,
        sender: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: messages });
  },
);

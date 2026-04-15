import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const Schema = z.object({ targetUserId: z.string().min(1) });

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const { targetUserId } = Schema.parse(await req.json());

  if (targetUserId === userId) {
    return NextResponse.json({ error: "Cannot DM yourself" }, { status: 400 });
  }

  // Find existing general_dm room between these two users
  const existing = await prisma.chatRoom.findFirst({
    where: {
      type: "general_dm",
      members: { every: { userId: { in: [userId, targetUserId] } } },
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, profilePicUrl: true, role: true, clientColor: true } },
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true, mediaType: true },
      },
    },
  });

  // Confirm it has exactly these two members (not a group with more)
  if (existing && existing.members.length === 2) {
    return NextResponse.json({ data: { ...existing, unreadCount: 0 } });
  }

  // Create new DM room
  const room = await prisma.chatRoom.create({
    data: {
      type: "general_dm",
      members: {
        create: [{ userId }, { userId: targetUserId }],
      },
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, profilePicUrl: true, role: true, clientColor: true } },
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true, mediaType: true },
      },
    },
  });

  return NextResponse.json({ data: { ...room, unreadCount: 0 } }, { status: 201 });
});

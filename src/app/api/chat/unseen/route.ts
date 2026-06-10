import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiHandler } from "@/lib/api/api-handler";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await prisma.chatRoomMember.findMany({
    where: { userId },
    select: { roomId: true, joinedAt: true, lastReadAt: true },
  });

  if (memberships.length === 0) {
    return NextResponse.json({ data: { count: 0 } });
  }

  const counts = await Promise.all(
    memberships.map((membership) =>
      prisma.message.count({
        where: {
          roomId: membership.roomId,
          senderId: { not: userId },
          deletedAt: null,
          createdAt: {
            gt: membership.lastReadAt ?? membership.joinedAt,
          },
        },
      }),
    ),
  );
  const count = counts.reduce((sum, value) => sum + value, 0);

  return NextResponse.json({ data: { count } });
});

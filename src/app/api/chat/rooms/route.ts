import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ensureProjectChatRooms } from "@/lib/project-chat";

export const dynamic = "force-dynamic";

// Room types considered "general" — i.e. shown on the top-level /chat page.
// Everything else (project rooms, task groups, workspace rooms, etc.) is
// "contextual" and lives inside its project/task/workspace page.
const GENERAL_ROOM_TYPES = ["general_group", "general_dm"];

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const role = req.headers.get("x-user-role") ?? "";
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const scope = url.searchParams.get("scope"); // "general" filters to general-chat rooms only

  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true },
    });
    if (
      project &&
      (["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(role) ||
        project.clientId === userId ||
        !!(await prisma.projectMember.findFirst({
          where: { projectId, userId },
          select: { id: true },
        })))
    ) {
      await ensureProjectChatRooms(prisma, projectId);
    }
  }

  const where = {
    members: { some: { userId } },
    ...(projectId ? { projectId } : {}),
    ...(scope === "general" ? { type: { in: GENERAL_ROOM_TYPES } } : {}),
  };

  const rooms = await prisma.chatRoom.findMany({
    where,
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profilePicUrl: true,
              role: true,
              clientColor: true,
            },
          },
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true, mediaType: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Add unread count per room (based on ChatRoomMember.lastReadAt)
  const roomsWithUnread = await Promise.all(
    rooms.map(async (room) => {
      const membership = room.members.find((m) => m.userId === userId);
      const unreadCount = await prisma.message.count({
        where: {
          roomId: room.id,
          senderId: { not: userId },
          deletedAt: null,
          ...(membership?.lastReadAt
            ? { createdAt: { gt: membership.lastReadAt } }
            : {}),
        },
      });
      return { ...room, unreadCount };
    })
  );

  return NextResponse.json({ data: roomsWithUnread });
});

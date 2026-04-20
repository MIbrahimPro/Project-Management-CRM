import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ensureProjectChatRooms } from "@/lib/project-chat";

export const dynamic = "force-dynamic";

// Room types considered "general" — i.e. shown on the top-level /chat page.
// Everything else (project rooms, task groups, workspace rooms, etc.) is
// "contextual" and lives inside its project/task/workspace page.
const GENERAL_ROOM_TYPES = ["general_group", "general_dm", "custom_group"];

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
      (["ADMIN", "PROJECT_MANAGER"].includes(role) ||
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
    deletedAt: null,
    ...(projectId ? { projectId } : {}),
    ...(scope === "general" ? { type: { in: GENERAL_ROOM_TYPES } } : {}),
  };

  const rooms = await prisma.chatRoom.findMany({
    where,
    select: {
      id: true,
      name: true,
      type: true,
      projectId: true,
      workspaceId: true,
      taskId: true,
      workspaceTaskId: true,
      hiringRequestId: true,
      createdById: true,
      adminsOnlyPosting: true,
      avatarUrl: true,
      createdAt: true,
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

  const isAdminOrPM = ["ADMIN", "PROJECT_MANAGER"].includes(role);

  const finalRooms = roomsWithUnread.filter((room) => {
    if (role === "CLIENT") {
      // Clients can only see DMs with managers/admins
      if (room.type === "general_dm") {
        const otherMember = room.members.find((m) => m.userId !== userId);
        const otherRole = otherMember?.user.role ?? "";
        if (!["ADMIN", "PROJECT_MANAGER"].includes(otherRole)) return false;
      }
      // Clients should not be in general "All Hands" groups
      if (room.type === "general_group") return false;
    } else if (!isAdminOrPM) {
      // Non-managers (Dev, Designer, etc.) cannot see DMs that involve a CLIENT
      if (room.type === "general_dm") {
        const hasClient = room.members.some((m) => m.user.role === "CLIENT");
        if (hasClient) return false;
      }
    }
    return true;
  }).map(room => {
    // Filter out SUPER_ADMIN from members list for EVERYONE (hidden role)
    // Also filter out non-managers if the viewer is a CLIENT
    const filteredMembers = room.members.filter(m => {
      if (m.user.role === "SUPER_ADMIN") return false;
      if (role === "CLIENT") {
        return ["ADMIN", "PROJECT_MANAGER", "CLIENT"].includes(m.user.role);
      }
      return true;
    });

    return {
      ...room,
      members: filteredMembers,
    };
  });

  return NextResponse.json({ data: finalRooms });
});

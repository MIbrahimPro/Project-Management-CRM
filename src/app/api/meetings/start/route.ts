import { NextRequest, NextResponse } from "next/server";
import type { Server as SocketIOServer } from "socket.io";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";
import { generateLiveKitToken, getLiveKitUrl } from "@/lib/livekit";
import { sendNotification } from "@/lib/notify";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];

const MESSAGE_INCLUDE = {
  sender: {
    select: {
      id: true,
      name: true,
      profilePicUrl: true,
      role: true,
      clientColor: true,
    },
  },
  replyTo: {
    select: {
      id: true,
      content: true,
      sender: { select: { name: true } },
    },
  },
  reactions: true,
} as const;

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  projectId: z.string().optional(),
  workspaceId: z.string().optional(),
  taskId: z.string().optional(),
  chatRoomId: z.string().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  isClientMeeting: z.boolean().optional(),
  invitedMemberIds: z.array(z.string()).optional(),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const body = bodySchema.parse(await req.json());

  // Only team/managers can start meetings — not clients
  if (userRole === "CLIENT") forbidden();
  // Client meetings require manager/admin
  if (body.isClientMeeting && !MANAGER_ROLES.includes(userRole)) forbidden();

  // Verify access based on context
  if (body.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: body.projectId },
      select: { members: { select: { userId: true } } },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const canAccess = MANAGER_ROLES.includes(userRole) || project.members.some(m => m.userId === userId);
    if (!canAccess) forbidden();
  } else if (body.workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: body.workspaceId },
      select: { members: { select: { userId: true } } },
    });
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    const canAccess = MANAGER_ROLES.includes(userRole) || workspace.members.some(m => m.userId === userId);
    if (!canAccess) forbidden();
  } else if (body.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: body.taskId },
      select: { assignees: { select: { userId: true } }, createdById: true },
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const canAccess = MANAGER_ROLES.includes(userRole) || task.createdById === userId || task.assignees.some(m => m.userId === userId);
    if (!canAccess) forbidden();
  }

  let chatRoomId: string | null = null;
  if (body.chatRoomId) {
    const roomMember = await prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId: body.chatRoomId, userId } },
      select: { roomId: true },
    });
    if (!roomMember) forbidden();
    chatRoomId = body.chatRoomId;
  } else if (body.projectId) {
    const teamRoom = await prisma.chatRoom.findFirst({
      where: {
        projectId: body.projectId,
        type: "project_team_group",
        members: { some: { userId } },
      },
      select: { id: true },
    });
    chatRoomId = teamRoom?.id ?? null;
  } else if (body.workspaceId) {
    const wsRoom = await prisma.chatRoom.findFirst({
      where: { workspaceId: body.workspaceId, members: { some: { userId } } },
      select: { id: true },
    });
    chatRoomId = wsRoom?.id ?? null;
  }

  const liveKitRoomId = `devrolin-${nanoid(12)}`;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) forbidden();

  const isModerator = MANAGER_ROLES.includes(userRole);

  const meeting = await prisma.meeting.create({
    data: {
      title: body.title,
      liveKitRoomId,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      projectId: body.projectId ?? null,
      workspaceId: body.workspaceId ?? null,
      taskId: body.taskId ?? null,
      chatRoomId,
      isClientMeeting: body.isClientMeeting ?? false,
      createdById: userId,
    },
    select: { id: true, title: true, liveKitRoomId: true },
  });

  // For client meetings, create invitee records for selected members + creator
  if (body.isClientMeeting && body.projectId) {
    const inviteeIds = new Set<string>([userId, ...(body.invitedMemberIds ?? [])]);
    await prisma.meetingInvitee.createMany({
      data: Array.from(inviteeIds).map((uid) => ({ meetingId: meeting.id, userId: uid })),
      skipDuplicates: true,
    });
  }

  const token = generateLiveKitToken(liveKitRoomId, {
    id: userId,
    name: user!.name,
    isModerator,
  });

  if (chatRoomId) {
    try {
      const inviteMessage = await prisma.message.create({
        data: {
          roomId: chatRoomId,
          senderId: userId,
          content: `Video call started: ${body.title}`,
          mediaUrl: `/meetings/${meeting.id}`,
          mediaType: "meeting_invite",
        },
        include: MESSAGE_INCLUDE,
      });

      const io = (globalThis as unknown as { io?: SocketIOServer }).io;
      io?.of("/chat").to(`room:${chatRoomId}`).emit("new_message", inviteMessage);
    } catch (inviteError) {
      console.error("[Meeting Start] Failed to post meeting invite message:", inviteError);
    }
  }

  // Notify project members when meeting is scheduled or started
  if (body.projectId) {
    const notifyLink = `/projects/${body.projectId}/meetings`;
    const isScheduled = !!body.scheduledAt;
    const notifTitle = isScheduled ? `Meeting Scheduled: ${body.title}` : `Meeting Started: ${body.title}`;
    const notifBody = isScheduled
      ? `Scheduled for ${new Date(body.scheduledAt!).toLocaleString()}`
      : "Join now";

    if (body.isClientMeeting) {
      // Client meetings: notify ONLY the selected invitees + project client + managers
      const project = await prisma.project.findUnique({
        where: { id: body.projectId },
        select: {
          clientId: true,
          members: {
            where: { user: { role: { in: ["ADMIN", "PROJECT_MANAGER", "SUPER_ADMIN"] } } },
            select: { userId: true },
          },
        },
      });
      const notifySet = new Set<string>();
      (body.invitedMemberIds ?? []).forEach((id) => notifySet.add(id));
      project?.members.forEach((m) => notifySet.add(m.userId));
      if (project?.clientId) notifySet.add(project.clientId);
      notifySet.delete(userId);
      for (const uid of Array.from(notifySet)) {
        await sendNotification(uid, "MEETING_SCHEDULED", notifTitle, notifBody, notifyLink);
      }
    } else {
      // Regular team meetings: notify all project members except creator + client
      const members = await prisma.projectMember.findMany({
        where: { projectId: body.projectId, userId: { not: userId } },
        select: { userId: true, user: { select: { role: true } } },
      });
      for (const m of members) {
        if (m.user.role !== "CLIENT") {
          await sendNotification(m.userId, "MEETING_SCHEDULED", notifTitle, notifBody, notifyLink);
        }
      }
    }
  }

  await logAction(userId, "MEETING_STARTED", "Meeting", meeting.id, {
    title: body.title,
    projectId: body.projectId ?? null,
    workspaceId: body.workspaceId ?? null,
    taskId: body.taskId ?? null,
    chatRoomId,
  });

  return NextResponse.json({
    data: {
      meetingId: meeting.id,
      liveKitRoomId: meeting.liveKitRoomId,
      url: getLiveKitUrl(),
      token: token ?? null,
      isModerator,
    },
  });
});

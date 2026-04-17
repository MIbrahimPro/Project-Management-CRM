import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"];

async function assertMeetingAccess(meetingId: string, userId: string, userRole: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      endedAt: true,
      project: {
        select: {
          clientId: true,
          members: { select: { userId: true } },
        },
      },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  if (meeting.endedAt) {
    return NextResponse.json({ error: "Meeting has ended", code: "GONE" }, { status: 410 });
  }

  const isManager = MANAGER_ROLES.includes(userRole);
  if (!isManager && meeting.project) {
    const isMember = meeting.project.members.some((m) => m.userId === userId);
    const isClient = userRole === "CLIENT" && meeting.project.clientId === userId;
    if (!isMember && !isClient) forbidden();
  }

  return null;
}

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const userRole = req.headers.get("x-user-role") ?? "";
  const meetingId = ctx?.params.id;

  if (!meetingId) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const accessError = await assertMeetingAccess(meetingId, userId, userRole);
  if (accessError) return accessError;

  const participant = await prisma.meetingParticipant.findUnique({
    where: { meetingId_userId: { meetingId, userId } },
    select: { id: true, leftAt: true, joinedAt: true },
  });

  return NextResponse.json({
    data: {
      joined: Boolean(participant) && participant?.leftAt === null,
      joinedAt: participant?.joinedAt ?? null,
      leftAt: participant?.leftAt ?? null,
    },
  });
});

export const POST = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const userRole = req.headers.get("x-user-role") ?? "";
  const meetingId = ctx?.params.id;

  if (!meetingId) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const accessError = await assertMeetingAccess(meetingId, userId, userRole);
  if (accessError) return accessError;

  const now = new Date();
  const participant = await prisma.meetingParticipant.upsert({
    where: { meetingId_userId: { meetingId, userId } },
    update: { joinedAt: now, leftAt: null },
    create: { meetingId, userId, joinedAt: now },
    select: { id: true, joinedAt: true, leftAt: true },
  });

  await logAction(userId, "MEETING_JOINED", "Meeting", meetingId, {
    source: "presence",
  });

  return NextResponse.json({
    data: {
      joined: true,
      joinedAt: participant.joinedAt,
      leftAt: participant.leftAt,
    },
  });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const userRole = req.headers.get("x-user-role") ?? "";
  const meetingId = ctx?.params.id;

  if (!meetingId) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const accessError = await assertMeetingAccess(meetingId, userId, userRole);
  if (accessError) return accessError;

  const participant = await prisma.meetingParticipant.findUnique({
    where: { meetingId_userId: { meetingId, userId } },
    select: { id: true, leftAt: true },
  });

  if (!participant) {
    return NextResponse.json({ data: { joined: false } });
  }

  if (participant.leftAt === null) {
    await prisma.meetingParticipant.update({
      where: { meetingId_userId: { meetingId, userId } },
      data: { leftAt: new Date() },
    });
    await logAction(userId, "MEETING_LEFT", "Meeting", meetingId, {
      source: "presence",
    });
  }

  return NextResponse.json({ data: { joined: false } });
});

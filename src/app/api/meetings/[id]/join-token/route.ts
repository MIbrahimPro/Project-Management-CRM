import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { generateJitsiToken, getJitsiDomain } from "@/lib/jitsi";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"];

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const meetingId = ctx?.params.id;
  if (!meetingId) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      jitsiRoomId: true,
      endedAt: true,
      projectId: true,
      project: {
        select: {
          clientId: true,
          members: { select: { userId: true } },
        },
      },
    },
  });
  if (!meeting) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  if (meeting.endedAt) {
    return NextResponse.json({ error: "Meeting has ended", code: "GONE" }, { status: 410 });
  }

  // Access check for project-scoped meetings
  const isManager = MANAGER_ROLES.includes(userRole);
  if (!isManager && meeting.project) {
    const isMember = meeting.project.members.some((m) => m.userId === userId);
    const isClient =
      userRole === "CLIENT" && meeting.project.clientId === userId;
    if (!isMember && !isClient) forbidden();
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) forbidden();

  const isModerator = MANAGER_ROLES.includes(userRole);

  // Upsert participant record
  await prisma.meetingParticipant.upsert({
    where: { meetingId_userId: { meetingId, userId } },
    update: { leftAt: null },
    create: { meetingId, userId },
  });

  const token = generateJitsiToken(meeting.jitsiRoomId, {
    id: userId,
    name: user!.name,
    isModerator,
  });

  await logAction(userId, "MEETING_JOINED", "Meeting", meetingId, {});

  return NextResponse.json({
    data: {
      meetingId,
      jitsiRoomId: meeting.jitsiRoomId,
      domain: getJitsiDomain(),
      token: token ?? null,
      isModerator,
    },
  });
});

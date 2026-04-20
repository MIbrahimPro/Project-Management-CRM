import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];

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
      workspace: {
        select: { members: { select: { userId: true } } },
      },
      task: {
        select: { assignees: { select: { userId: true } }, createdById: true },
      },
      interview: { select: { interviewers: { select: { id: true } } } },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  if (meeting.endedAt) {
    return NextResponse.json({ error: "Meeting has ended", code: "GONE" }, { status: 410 });
  }

  const isManager = MANAGER_ROLES.includes(userRole);
  if (isManager) return null;

  if (meeting.project) {
    const isMember = meeting.project.members.some((m) => m.userId === userId);
    const isClient = userRole === "CLIENT" && meeting.project.clientId === userId;
    if (!isMember && !isClient) return forbidden();
  } else if (meeting.workspace) {
    const isMember = meeting.workspace.members.some((m) => m.userId === userId);
    if (!isMember) return forbidden();
  } else if (meeting.task) {
    const isAssignee = meeting.task.assignees.some((m) => m.userId === userId);
    const isCreator = meeting.task.createdById === userId;
    if (!isAssignee && !isCreator) return forbidden();
  } else if (meeting.interview) {
    const isInterviewer = meeting.interview.interviewers.some((u) => u.id === userId);
    if (!isInterviewer) return forbidden();
  }

  return null;
}

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const userRole = req.headers.get("x-user-role") ?? "";
  const meetingId = ctx?.params.id as string | undefined;

  if (!meetingId) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const accessError = await assertMeetingAccess(meetingId, userId, userRole);
  if (accessError) return accessError;

  const participants = await prisma.meetingParticipant.findMany({
    where: { meetingId, leftAt: null },
    include: { user: { select: { id: true, name: true, profilePicUrl: true, role: true } } },
  });

  return NextResponse.json({ data: participants.map((p) => ({ id: p.user.id, name: p.user.name, role: p.user.role, profilePicUrl: p.user.profilePicUrl })) });
});

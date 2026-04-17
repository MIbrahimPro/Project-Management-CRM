import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { generateJitsiToken, getJitsiDomain, getJitsiServerUrl } from "@/lib/jitsi";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"];
const CLIENT_INVITER_ROLES_ALLOWED = ["ADMIN", "PROJECT_MANAGER"];

function normalizeGuestName(rawName: string | null): string {
  const normalized = (rawName ?? "").trim().replace(/\s+/g, " ").slice(0, 48);
  return normalized || "Guest";
}

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  const isGuestJoin = req.nextUrl.searchParams.get("guest") === "1";

  if (!userId && !isGuestJoin) {
    return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  }

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

  if (isGuestJoin && !userId) {
    return NextResponse.json({
      data: {
        meetingId,
        jitsiRoomId: meeting.jitsiRoomId,
        domain: getJitsiDomain(),
        serverUrl: getJitsiServerUrl(),
        token: null,
        isModerator: false,
        canInviteUsers: false,
        canInviteClients: false,
        isGuest: true,
        displayName: normalizeGuestName(req.nextUrl.searchParams.get("name")),
      },
    });
  }

  const authenticatedUserId = userId as string;

  // Access check for project-scoped meetings
  const isManager = MANAGER_ROLES.includes(userRole);
  if (!isManager && meeting.project) {
    const isMember = meeting.project.members.some((m) => m.userId === authenticatedUserId);
    const isClient =
      userRole === "CLIENT" && meeting.project.clientId === authenticatedUserId;
    if (!isMember && !isClient) forbidden();
  }

  const user = await prisma.user.findUnique({
    where: { id: authenticatedUserId },
    select: { id: true, name: true },
  });
  if (!user) forbidden();

  const isModerator = MANAGER_ROLES.includes(userRole);

  const token = generateJitsiToken(meeting.jitsiRoomId, {
    id: authenticatedUserId,
    name: user!.name,
    isModerator,
  });

  return NextResponse.json({
    data: {
      meetingId,
      jitsiRoomId: meeting.jitsiRoomId,
      domain: getJitsiDomain(),
      serverUrl: getJitsiServerUrl(),
      token: token ?? null,
      isModerator,
      canInviteUsers: userRole !== "CLIENT",
      canInviteClients: CLIENT_INVITER_ROLES_ALLOWED.includes(userRole),
      isGuest: false,
      displayName: null,
    },
  });
});

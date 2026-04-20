import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER", "SUPER_ADMIN"];

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const isClient = userRole === "CLIENT";
  const isManager = MANAGER_ROLES.includes(userRole);

  // Managers see everything.
  // Clients only see client meetings on the project.
  // Non-manager team members see: (a) all non-client meetings, (b) client meetings
  //   they were invited to, and (c) client meetings that have already ended
  //   (so recordings/history remain visible to non-attendees per Phase 7.5).
  const where = isManager
    ? { projectId }
    : isClient
      ? { projectId, isClientMeeting: true }
      : {
          projectId,
          OR: [
            { isClientMeeting: false },
            { isClientMeeting: true, invitees: { some: { userId } } },
            { isClientMeeting: true, endedAt: { not: null } },
          ],
        };

  const meetings = await prisma.meeting.findMany({
    where,
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      title: true,
      liveKitRoomId: true,
      scheduledAt: true,
      startedAt: true,
      endedAt: true,
      isClientMeeting: true,
      createdById: true,
      participants: {
        select: { userId: true, user: { select: { id: true, name: true } }, joinedAt: true, leftAt: true },
      },
      recordings: {
        select: { id: true, title: true, storagePath: true, durationSec: true, createdAt: true, uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      invitees: {
        select: { userId: true },
      },
    },
  });

  return NextResponse.json({ data: meetings });
});

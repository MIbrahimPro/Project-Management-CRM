import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";
import { generateJitsiToken, getJitsiDomain } from "@/lib/jitsi";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"];

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  projectId: z.string().optional(),
  chatRoomId: z.string().optional(),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const body = bodySchema.parse(await req.json());

  // Only team/managers can start meetings — not clients
  if (userRole === "CLIENT") forbidden();

  // Verify project access if projectId provided
  if (body.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: body.projectId },
      select: {
        id: true,
        clientId: true,
        members: { select: { userId: true } },
      },
    });
    if (!project) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    const canAccess =
      MANAGER_ROLES.includes(userRole) ||
      project.members.some((m) => m.userId === userId);
    if (!canAccess) forbidden();
  }

  const jitsiRoomId = `devrolin-${nanoid(12)}`;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) forbidden();

  const isModerator = MANAGER_ROLES.includes(userRole);

  const meeting = await prisma.meeting.create({
    data: {
      title: body.title,
      jitsiRoomId,
      projectId: body.projectId ?? null,
      chatRoomId: body.chatRoomId ?? null,
      createdById: userId,
      participants: {
        create: { userId },
      },
    },
    select: { id: true, title: true, jitsiRoomId: true },
  });

  const token = generateJitsiToken(jitsiRoomId, {
    id: userId,
    name: user!.name,
    isModerator,
  });

  await logAction(userId, "MEETING_STARTED", "Meeting", meeting.id, {
    title: body.title,
    projectId: body.projectId ?? null,
  });

  return NextResponse.json({
    data: {
      meetingId: meeting.id,
      jitsiRoomId: meeting.jitsiRoomId,
      domain: getJitsiDomain(),
      token: token ?? null,
      isModerator,
    },
  });
});

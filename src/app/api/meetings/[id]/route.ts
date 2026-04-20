import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";
import { sendNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export const PATCH = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!MANAGER_ROLES.includes(userRole)) forbidden();

  const meetingId = ctx?.params.id;
  if (!meetingId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, title: true, projectId: true, endedAt: true },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (meeting.endedAt) return NextResponse.json({ error: "Cannot edit an ended meeting" }, { status: 400 });

  const body = patchSchema.parse(await req.json());
  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.scheduledAt !== undefined && { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null }),
    },
    select: { id: true, title: true, scheduledAt: true },
  });

  // Notify project members on reschedule
  if (meeting.projectId && body.scheduledAt !== undefined) {
    const members = await prisma.projectMember.findMany({
      where: { projectId: meeting.projectId, userId: { not: userId } },
      select: { userId: true, user: { select: { role: true } } },
    });
    for (const m of members) {
      if (m.user.role !== "CLIENT") {
        const notifBody = body.scheduledAt
          ? `Rescheduled to ${new Date(body.scheduledAt).toLocaleString()}`
          : "Schedule updated";
        await sendNotification(
          m.userId,
          "MEETING_SCHEDULED",
          `Meeting Updated: ${updated.title}`,
          notifBody,
          `/projects/${meeting.projectId}/meetings`
        );
      }
    }
  }

  await logAction(userId, "MEETING_UPDATED", "Meeting", meetingId);
  return NextResponse.json({ data: updated });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!MANAGER_ROLES.includes(userRole)) forbidden();

  const meetingId = ctx?.params.id;
  if (!meetingId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, title: true, projectId: true, endedAt: true },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (meeting.endedAt) return NextResponse.json({ error: "Cannot delete an ended meeting" }, { status: 400 });

  // Notify members of cancellation
  if (meeting.projectId) {
    const members = await prisma.projectMember.findMany({
      where: { projectId: meeting.projectId, userId: { not: userId } },
      select: { userId: true, user: { select: { role: true } } },
    });
    for (const m of members) {
      if (m.user.role !== "CLIENT") {
        await sendNotification(
          m.userId,
          "MEETING_SCHEDULED",
          `Meeting Cancelled: ${meeting.title}`,
          "This meeting has been cancelled",
          `/projects/${meeting.projectId}/meetings`
        );
      }
    }
  }

  await prisma.$transaction([
    prisma.meetingParticipant.deleteMany({ where: { meetingId } }),
    prisma.meeting.delete({ where: { id: meetingId } }),
  ]);

  await logAction(userId, "MEETING_DELETED", "Meeting", meetingId);
  return NextResponse.json({ data: { id: meetingId } });
});

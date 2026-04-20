import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];
const HR_ROLES = [...MANAGER_ROLES, "HR"];

const patchSchema = z.object({
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "OPEN", "CLOSED", "CANCELLED"]).optional(),
  publicTitle: z.string().optional(),
  publicDescription: z.string().optional(),
  deadline: z.string().datetime().optional().nullable(),
  managerApproved: z.boolean().optional(),
  hrApproved: z.boolean().optional(),
  adminApproved: z.boolean().optional(),
  publish: z.boolean().optional(), // set status=OPEN and generate publicSlug
});

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!HR_ROLES.includes(userRole)) forbidden();

  const id = ctx?.params.id ?? "";
  const request = await prisma.hiringRequest.findUnique({
    where: { id },
    select: {
      id: true,
      statedRole: true,
      role: true,
      description: true,
      publicTitle: true,
      publicDescription: true,
      publicSlug: true,
      status: true,
      managerApproved: true,
      hrApproved: true,
      adminApproved: true,
      deadline: true,
      createdAt: true,
      requestedBy: { select: { id: true, name: true } },
      hr: { select: { id: true, name: true } },
      questions: { orderBy: { order: "asc" }, select: { id: true, text: true, type: true, appliesToPublicForm: true, required: true, order: true } },
      candidates: {
        orderBy: { appliedAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          isAiRecommended: true,
          isHrRecommended: true,
          appliedAt: true,
          interviewAt: true,
          internalNotes: true,
          cvUrl: true,
          answers: {
            select: {
              answer: true,
              question: { select: { text: true } },
            },
          },
          interviews: {
            orderBy: { startTime: "asc" },
            select: { id: true, startTime: true, endTime: true, roomId: true, status: true }
          }
        },
      },
    },
  });
  if (!request) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ data: request });
});

export const PATCH = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!HR_ROLES.includes(userRole)) forbidden();

  const id = ctx?.params.id ?? "";
  const body = patchSchema.parse(await req.json());

  const existing = await prisma.hiringRequest.findUnique({
    where: { id },
    select: { id: true, publicSlug: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  // Only managers/admins can approve
  if ((body.managerApproved !== undefined || body.adminApproved !== undefined) && !MANAGER_ROLES.includes(userRole)) {
    forbidden();
  }

  const updateData: Record<string, unknown> = {};
  if (body.status !== undefined) updateData.status = body.status;
  if (body.publicTitle !== undefined) updateData.publicTitle = body.publicTitle;
  if (body.publicDescription !== undefined) updateData.publicDescription = body.publicDescription;
  if (body.deadline !== undefined) updateData.deadline = body.deadline ? new Date(body.deadline) : null;
  if (body.managerApproved !== undefined) updateData.managerApproved = body.managerApproved;
  if (body.hrApproved !== undefined) updateData.hrApproved = body.hrApproved;
  if (body.adminApproved !== undefined) updateData.adminApproved = body.adminApproved;

  if (body.publish) {
    updateData.status = "OPEN";
    if (!existing.publicSlug) {
      updateData.publicSlug = `${nanoid(10)}`;
    }
  } else if (existing.status === "OPEN" && body.status !== "OPEN") {
    // If unpublishing (changing status away from OPEN), revert to DRAFT unless explicitly closing/cancelling
    if (!body.status || body.status === "PENDING_APPROVAL") {
      updateData.status = "DRAFT";
    }
  }

  // Lock edits for published requests (except status changes)
  if (existing.status === "OPEN" && !body.publish) {
    const attemptedEdits = Object.keys(updateData).filter(k => k !== "status");
    if (attemptedEdits.length > 0 && updateData.status === undefined) {
      return NextResponse.json({ error: "Published requests are read-only. Unpublish first to edit.", code: "LOCKED" }, { status: 400 });
    }
  }

  const updated = await prisma.hiringRequest.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      status: true,
      publicSlug: true,
      managerApproved: true,
      hrApproved: true,
      adminApproved: true,
    },
  });

  await logAction(userId, "HIRING_REQUEST_UPDATED", "HiringRequest", id, { changes: Object.keys(updateData) });
  return NextResponse.json({ data: updated });
});

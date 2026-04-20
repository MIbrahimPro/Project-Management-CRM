import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";
import { sendNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

const HR_ROLES = ["ADMIN", "PROJECT_MANAGER", "HR"];

const patchSchema = z.object({
  status: z.enum([
    "APPLIED", "UNDER_REVIEW", "SHORTLISTED", 
    "INTERVIEW_SCHEDULED", "HIRED", "REJECTED",
  ]).optional(),
  isAiRecommended: z.boolean().optional(),
  isHrRecommended: z.boolean().optional(),
  internalNotes: z.string().optional(),
  interviewAt: z.string().datetime().optional().nullable(),
});

export const PATCH = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!HR_ROLES.includes(userRole)) forbidden();

  const requestId = ctx?.params.id ?? "";
  const candidateId = ctx?.params.cId ?? "";

  const body = patchSchema.parse(await req.json());

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, requestId },
    select: { id: true, name: true },
  });
  if (!candidate) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (body.status !== undefined) updateData.status = body.status;
  if (body.isAiRecommended !== undefined) updateData.isAiRecommended = body.isAiRecommended;
  if (body.isHrRecommended !== undefined) updateData.isHrRecommended = body.isHrRecommended;
  if (body.internalNotes !== undefined) updateData.internalNotes = body.internalNotes;
  if (body.interviewAt !== undefined) {
    updateData.interviewAt = body.interviewAt ? new Date(body.interviewAt) : null;
    if (body.interviewAt) updateData.status = "INTERVIEW_SCHEDULED";
  }

  const updated = await prisma.candidate.update({
    where: { id: candidateId },
    data: updateData,
    select: {
      id: true,
      status: true,
      isAiRecommended: true,
      isHrRecommended: true,
      internalNotes: true,
      interviewAt: true,
    },
  });

  await logAction(userId, "CANDIDATE_UPDATED", "Candidate", candidateId, { changes: Object.keys(updateData) });

  if (body.status === "HIRED") {
    // Notify all HR and Admins to upload contract
    const hrUsers = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "HR"] },
        isActive: true,
      },
      select: { id: true },
    });
    
    for (const hr of hrUsers) {
      await sendNotification(
        hr.id,
        "HIRING_UPDATE",
        "Action Required: Contract Upload",
        `Candidate ${candidate.name} has been hired. Please upload their contract.`,
        `/contracts`
      );
    }
  }

  return NextResponse.json({ data: updated });
});

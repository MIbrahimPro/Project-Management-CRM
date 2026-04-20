import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"] as const;

const PatchSchema = z.object({
  text: z.string().min(5).max(500),
  partOf: z.string().optional(),
});

export const PATCH = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const { id: projectId, qId } = ctx?.params ?? {};
    if (!projectId || !qId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const question = await prisma.projectQuestion.findUnique({
      where: { id: qId, projectId },
      select: { id: true, isApproved: true, createdById: true },
    });
    if (!question) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const isManager = (MANAGER_ROLES as readonly string[]).includes(role);
    const isOwner = question.createdById === userId;

    // Approved questions: only manager/admin can edit
    // Pending questions: creator or manager/admin can edit
    if (question.isApproved && !isManager) forbidden();
    if (!question.isApproved && !isOwner && !isManager) forbidden();

    const body = PatchSchema.parse(await req.json());

    const updated = await prisma.projectQuestion.update({
      where: { id: qId },
      data: { text: body.text, ...(body.partOf !== undefined && { partOf: body.partOf }) },
      include: {
        answers: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, role: true } } },
        },
        milestone: { select: { id: true, order: true, title: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    await logAction(userId, "QUESTION_UPDATED", "ProjectQuestion", qId);

    return NextResponse.json({ data: updated });
  }
);

export const DELETE = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const { id: projectId, qId } = ctx?.params ?? {};
    if (!projectId || !qId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const question = await prisma.projectQuestion.findUnique({
      where: { id: qId, projectId },
      select: { id: true, isApproved: true, createdById: true },
    });
    if (!question) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const isManager = (MANAGER_ROLES as readonly string[]).includes(role);
    const isOwner = question.createdById === userId;

    // Approved: only manager/admin can delete
    // Pending: creator or manager/admin can delete
    if (question.isApproved && !isManager) forbidden();
    if (!question.isApproved && !isOwner && !isManager) forbidden();

    await prisma.projectQuestion.delete({ where: { id: qId } });
    await logAction(userId, "QUESTION_DELETED", "ProjectQuestion", qId);

    return NextResponse.json({ success: true });
  }
);

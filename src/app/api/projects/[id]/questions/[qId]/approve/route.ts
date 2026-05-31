import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

export const PATCH = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    if (!["ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

    const projectId = ctx?.params.id;
    const qId = ctx?.params.qId;
    if (!projectId || !qId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const updated = await prisma.projectQuestion.updateMany({
      where: { id: qId, projectId },
      data: { isApproved: true },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await logAction(userId, "QUESTION_APPROVED", "ProjectQuestion", qId);

    const question = await prisma.projectQuestion.findUnique({
      where: { id: qId },
      include: {
        answers: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, role: true } } },
        },
        milestone: { select: { id: true, order: true, title: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (global.io && question) {
      global.io
        .of("/chat")
        .to(`project:${projectId}`)
        .emit("question_approved", question);
    } else if (!global.io) {
      console.error(`[Socket] FAILED question_approved – global.io null`);
    }

    return NextResponse.json({ success: true });
  }
);

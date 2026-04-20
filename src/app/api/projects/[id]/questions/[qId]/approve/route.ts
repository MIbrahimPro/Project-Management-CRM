import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

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

    // Server-side broadcast so all viewers get the update even if client relay fails
    if (global.io) {
      global.io
        .of("/chat")
        .to(`project_questions:${projectId}`)
        .emit("question_approved", { questionId: qId });
    }

    return NextResponse.json({ success: true });
  }
);

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

const AnswerSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const POST = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    const questionId = ctx?.params.qId;
    if (!projectId || !questionId)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { clientId: true },
    });
    const isClient = project?.clientId === userId;
    const isManager = ["ADMIN", "PROJECT_MANAGER"].includes(role);

    if (!isClient && !isManager) forbidden();

    const { content } = AnswerSchema.parse(await req.json());

    // Upsert: update existing answer from this user for this question, or create new
    const existingAnswer = await prisma.questionAnswer.findFirst({
      where: { questionId, userId },
      orderBy: { createdAt: "desc" },
    });

    const answer = existingAnswer
      ? await prisma.questionAnswer.update({
          where: { id: existingAnswer.id },
          data: { content },
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
        })
      : await prisma.questionAnswer.create({
          data: { questionId, userId, content },
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
        });

    await logAction(userId, "QUESTION_ANSWERED", "QuestionAnswer", answer.id);

    // Emit socket event for real-time updates
    if (global.io) {
      global.io
        .of("/chat")
        .to(`project:${projectId}`)
        .emit("question_answered", { questionId, answer });
    } else {
      console.error(`[Socket] FAILED question_answered – global.io null`);
    }

    return NextResponse.json({ data: answer }, { status: existingAnswer ? 200 : 201 });
  }
);

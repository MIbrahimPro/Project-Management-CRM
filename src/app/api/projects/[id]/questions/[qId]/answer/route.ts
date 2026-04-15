import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notify";
import { logAction } from "@/lib/audit";

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
    const isManager = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(role);

    if (!isClient && !isManager) forbidden();

    const { content } = AnswerSchema.parse(await req.json());

    const answer = await prisma.questionAnswer.create({
      data: { questionId, userId, content },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    await logAction(userId, "QUESTION_ANSWERED", "QuestionAnswer", answer.id);

    // Notify managers when client answers; notify client when manager answers
    if (isClient) {
      const managers = await prisma.projectMember.findMany({
        where: {
          projectId,
          user: { role: { in: ["PROJECT_MANAGER", "ADMIN"] } },
        },
        select: { userId: true },
      });
      await Promise.all(
        managers.map((m) =>
          sendNotification(
            m.userId,
            "QUESTION_ANSWERED",
            "Client Answered a Question",
            `Client has answered a project question`,
            `/projects/${projectId}/questions?highlight=${questionId}`
          )
        )
      );
    } else if (project?.clientId) {
      await sendNotification(
        project.clientId,
        "QUESTION_ANSWERED",
        "Question Answered",
        `Your project question has been answered`,
        `/projects/${projectId}/questions?highlight=${questionId}`
      );
    }

    return NextResponse.json({ data: answer }, { status: 201 });
  }
);

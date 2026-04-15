import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notify";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"] as const;

export const GET = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const [project, member] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } }),
      prisma.projectMember.findFirst({ where: { projectId, userId } }),
    ]);

    const isClient = project?.clientId === userId;
    const isManager = (MANAGER_ROLES as readonly string[]).includes(role);

    if (!member && !isClient && !isManager) forbidden();

    // Clients only see approved questions
    const where = isClient
      ? { projectId, isApproved: true }
      : { projectId };

    const questions = await prisma.projectQuestion.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        answers: {
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
        },
        milestone: { select: { id: true, order: true, title: true } },
      },
    });

    return NextResponse.json({ data: questions });
  }
);

const PostSchema = z.object({
  text: z.string().min(5).max(500),
  partOf: z.string(),
  milestoneId: z.string().optional().nullable(),
});

export const POST = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    if (role === "CLIENT") forbidden();

    const body = PostSchema.parse(await req.json());
    const isManager = (MANAGER_ROLES as readonly string[]).includes(role);

    const question = await prisma.projectQuestion.create({
      data: {
        projectId,
        text: body.text,
        partOf: body.partOf,
        milestoneId: body.milestoneId ?? null,
        isApproved: isManager,
        isAiGenerated: false,
        createdById: userId,
      },
    });

    await logAction(userId, "QUESTION_CREATED", "ProjectQuestion", question.id);

    // Notify managers if not already a manager (question needs approval)
    if (!isManager) {
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
            "PROJECT_UPDATE",
            "Question Needs Approval",
            `A team member added a question awaiting your approval`,
            `/projects/${projectId}/questions`
          )
        )
      );
    }

    return NextResponse.json({ data: question }, { status: 201 });
  }
);

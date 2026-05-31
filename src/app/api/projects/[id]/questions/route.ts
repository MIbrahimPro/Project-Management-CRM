import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"] as const;

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
    const isMember = !!member;

    if (!member && !isClient && !isManager) {
      console.log("[Questions API] ACCESS DENIED - member:", !!member, "isClient:", isClient, "isManager:", isManager);
      forbidden();
    }

    // Clients only see approved questions; members and managers see all
    const where = isClient
      ? { projectId, isApproved: true }
      : { projectId };

    console.log("[Questions API] userId:", userId, "role:", role, "isClient:", isClient, "isManager:", isManager, "isMember:", isMember);

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
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    console.log("[Questions API] total:", questions.length, "unapproved:", questions.filter(q => !q.isApproved).length);

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

    const isManager = (MANAGER_ROLES as readonly string[]).includes(role);

    const body = PostSchema.parse(await req.json());

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
      include: {
        answers: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, role: true } } },
        },
        milestone: { select: { id: true, order: true, title: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    await logAction(userId, "QUESTION_CREATED", "ProjectQuestion", question.id);

    // Emit socket event for real-time updates
    if (global.io) {
      global.io
        .of("/chat")
        .to(`project:${projectId}`)
        .emit("question_added", question);
    } else {
      console.error(`[Socket] FAILED to emit – global.io is NULL/UNDEFINED`);
    }

    return NextResponse.json({ data: question }, { status: 201 });
  }
);

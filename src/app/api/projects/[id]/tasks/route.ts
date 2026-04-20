import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];

const CreateSchema = z.object({
  title: z.string().min(1).max(300),
});

// GET /api/projects/[id]/tasks — list tasks for this project
export const GET = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    if (role === "CLIENT") forbidden();

    // Check access: manager or project member
    const isManager = MANAGER_ROLES.includes(role);
    if (!isManager) {
      const member = await prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { id: true },
      });
      if (!member) forbidden();
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, profilePicUrl: true, role: true },
            },
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: tasks });
  }
);

// POST /api/projects/[id]/tasks — create a task, auto-assign admins/managers + creator
export const POST = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    if (role === "CLIENT") forbidden();

    const body = CreateSchema.parse(await req.json());

    // Auto-assign: all admin/manager project members + the creator
    const adminManagerMembers = await prisma.projectMember.findMany({
      where: {
        projectId,
        user: { role: { in: ["ADMIN", "PROJECT_MANAGER"] }, isActive: true },
      },
      select: { userId: true },
    });

    const assigneeIds = new Set<string>(adminManagerMembers.map((m) => m.userId));
    assigneeIds.add(userId); // always include creator

    const task = await prisma.$transaction(async (tx) => {
      const t = await tx.task.create({
        data: {
          title: body.title,
          projectId,
          createdById: userId,
          status: "TODO",
          assignees: {
            create: Array.from(assigneeIds).map((uid) => ({ userId: uid })),
          },
        },
        include: {
          assignees: {
            include: {
              user: {
                select: { id: true, name: true, profilePicUrl: true, role: true },
              },
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
      });
      return t;
    });

    await logAction(userId, "TASK_CREATED", "Task", task.id, { projectId, title: body.title });

    return NextResponse.json({ data: task }, { status: 201 });
  }
);

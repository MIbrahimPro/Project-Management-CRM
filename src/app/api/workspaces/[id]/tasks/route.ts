import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(["IDEA", "IN_PROGRESS", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"]).optional(),
  assigneeIds: z.array(z.string()).optional(),
});

async function assertMember(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { userId: true },
  });
  if (!member) forbidden();
}

export const POST = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const workspaceId = ctx?.params.id ?? "";
  await assertMember(workspaceId, userId);

  const body = createSchema.parse(await req.json());

  const task = await prisma.workspaceTask.create({
    data: {
      workspaceId,
      title: body.title,
      description: body.description,
      status: body.status ?? "IDEA",
      assigneeIds: body.assigneeIds ?? [],
      createdById: userId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      assigneeIds: true,
      attachments: true,
      thumbnailPath: true,
      postedAt: true,
      completedAt: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await logAction(userId, "WORKSPACE_TASK_CREATED", "WorkspaceTask", task.id, { title: body.title });
  return NextResponse.json({ data: task }, { status: 201 });
});

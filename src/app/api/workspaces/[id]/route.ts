import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const id = ctx?.params.id ?? "";
  const workspace = await prisma.workspace.findUnique({
    where: { id, isActive: true },
    select: {
      id: true,
      name: true,
      type: true,
      description: true,
      createdById: true,
      createdAt: true,
      members: {
        select: {
          userId: true,
          user: { select: { id: true, name: true, profilePicUrl: true, role: true } },
        },
      },
      tasks: {
        orderBy: { createdAt: "asc" },
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
      },
    },
  });

  if (!workspace) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const isMember = workspace.members.some((m) => m.userId === userId);
  if (!isMember) forbidden();

  return NextResponse.json({ data: workspace });
});

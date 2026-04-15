import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["INSTAGRAM", "LINKEDIN", "TWITTER", "YOUTUBE", "GENERAL", "CUSTOM"]),
  description: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
});

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"];

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const workspaces = await prisma.workspace.findMany({
    where: {
      isActive: true,
      OR: [
        { createdById: userId },
        { members: { some: { userId } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      description: true,
      createdAt: true,
      _count: { select: { tasks: true, members: true } },
      members: {
        take: 5,
        select: { user: { select: { id: true, name: true, profilePicUrl: true } } },
      },
    },
  });

  return NextResponse.json({ data: workspaces });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!MANAGER_ROLES.includes(userRole)) {
    return NextResponse.json(
      { error: "Only managers can create social media boards", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const body = createSchema.parse(await req.json());

  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        name: body.name,
        type: body.type,
        description: body.description,
        createdById: userId,
        members: {
          create: [
            { userId }, // creator always a member
            ...(body.memberIds ?? [])
              .filter((id) => id !== userId)
              .map((id) => ({ userId: id })),
          ],
        },
      },
      select: { id: true, name: true, type: true, createdAt: true },
    });

    // Create a general workspace chat room
    await tx.chatRoom.create({
      data: {
        name: body.name,
        type: "workspace_group",
        workspaceId: ws.id,
        members: {
          create: [
            { userId },
            ...(body.memberIds ?? [])
              .filter((id) => id !== userId)
              .map((id) => ({ userId: id })),
          ],
        },
      },
    });

    return ws;
  });

  await logAction(userId, "WORKSPACE_CREATED", "Workspace", workspace.id, { name: body.name });
  return NextResponse.json({ data: workspace }, { status: 201 });
});

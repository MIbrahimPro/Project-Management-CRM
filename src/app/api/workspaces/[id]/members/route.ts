import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  userId: z.string().min(1),
});

const MANAGER_ROLES = new Set(["ADMIN", "PROJECT_MANAGER"]);

/**
 * Returns true if the actor may add or remove members (except self-leave rules handled separately).
 */
function canManageMembers(role: string, workspaceCreatedById: string, actorId: string): boolean {
  return MANAGER_ROLES.has(role) || workspaceCreatedById === actorId;
}

/**
 * Adds a user to the workspace and the main `workspace_group` chat room.
 */
export const POST = apiHandler(async (req: NextRequest, ctx) => {
  const actorId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role") ?? "";
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const workspaceId = ctx?.params.id ?? "";
  const body = postSchema.parse(await req.json());

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, isActive: true },
    select: {
      id: true,
      createdById: true,
      members: { select: { userId: true } },
    },
  });
  if (!workspace) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const actorIsMember = workspace.members.some((m) => m.userId === actorId);
  if (!actorIsMember) forbidden();

  if (!canManageMembers(role, workspace.createdById, actorId)) forbidden();

  if (workspace.members.some((m) => m.userId === body.userId)) {
    return NextResponse.json({ error: "User is already a member", code: "CONFLICT" }, { status: 409 });
  }

  const targetUser = await prisma.user.findFirst({
    where: { id: body.userId, isActive: true },
    select: { id: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.create({
      data: { workspaceId, userId: body.userId },
    });

    const groupRoom = await tx.chatRoom.findFirst({
      where: { workspaceId, type: "workspace_group" },
      select: { id: true },
    });
    if (groupRoom) {
      await tx.chatRoomMember.create({
        data: { roomId: groupRoom.id, userId: body.userId },
      });
    }
  });

  await logAction(actorId, "WORKSPACE_MEMBER_ADDED", "Workspace", workspaceId, {
    addedUserId: body.userId,
  });

  return NextResponse.json({ data: { userId: body.userId } }, { status: 201 });
});

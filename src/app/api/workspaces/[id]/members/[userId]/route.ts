import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"]);

function canManageMembers(role: string, workspaceCreatedById: string, actorId: string): boolean {
  return MANAGER_ROLES.has(role) || workspaceCreatedById === actorId;
}

/**
 * Removes a member from the workspace, related chat rooms, and workspace task assignee lists.
 */
export const DELETE = apiHandler(async (req: NextRequest, ctx) => {
  const actorId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role") ?? "";
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const workspaceId = ctx?.params.id ?? "";
  const targetUserId = ctx?.params.userId ?? "";

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

  const memberCount = workspace.members.length;
  const isSelf = targetUserId === actorId;
  const actorIsMember = workspace.members.some((m) => m.userId === actorId);
  const targetIsMember = workspace.members.some((m) => m.userId === targetUserId);

  if (!targetIsMember) {
    return NextResponse.json({ error: "User is not a member", code: "NOT_FOUND" }, { status: 404 });
  }

  if (isSelf) {
    if (memberCount <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last member", code: "CONFLICT" },
        { status: 409 }
      );
    }
  } else {
    if (!actorIsMember) forbidden();
    if (!canManageMembers(role, workspace.createdById, actorId)) forbidden();
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });

    const rooms = await tx.chatRoom.findMany({
      where: {
        OR: [{ workspaceId, type: "workspace_group" }, { workspaceTask: { workspaceId } }],
      },
      select: { id: true },
    });
    for (const r of rooms) {
      await tx.chatRoomMember.deleteMany({
        where: { roomId: r.id, userId: targetUserId },
      });
    }

    const tasks = await tx.workspaceTask.findMany({
      where: { workspaceId, assigneeIds: { has: targetUserId } },
      select: { id: true, assigneeIds: true },
    });
    for (const t of tasks) {
      await tx.workspaceTask.update({
        where: { id: t.id },
        data: { assigneeIds: t.assigneeIds.filter((id) => id !== targetUserId) },
      });
    }
  });

  await logAction(actorId, "WORKSPACE_MEMBER_REMOVED", "Workspace", workspaceId, {
    removedUserId: targetUserId,
  });

  return NextResponse.json({ success: true });
});

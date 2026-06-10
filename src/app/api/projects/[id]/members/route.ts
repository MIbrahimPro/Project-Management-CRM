import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];

export const GET = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const isManager = MANAGER_ROLES.includes(role);
    if (!isManager) {
      const member = await prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { id: true },
      });
      if (!member) forbidden();
    }

    const [projectMembers, managers] = await Promise.all([
      prisma.projectMember.findMany({
        where: {
          projectId,
          user: { isActive: true, role: { notIn: ["CLIENT", "SUPER_ADMIN"] } },
        },
        select: {
          userId: true,
          user: { select: { id: true, name: true, profilePicUrl: true, role: true } },
        },
      }),
      prisma.user.findMany({
        where: { isActive: true, role: { in: ["ADMIN", "PROJECT_MANAGER"] } },
        select: { id: true, name: true, profilePicUrl: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const byUserId = new Map<
      string,
      { userId: string; user: { id: string; name: string; profilePicUrl: string | null; role: string } }
    >();
    for (const manager of managers) {
      byUserId.set(manager.id, { userId: manager.id, user: manager });
    }
    for (const member of projectMembers) {
      byUserId.set(member.userId, member);
    }

    return NextResponse.json({
      data: Array.from(byUserId.values()).sort((a, b) => a.user.name.localeCompare(b.user.name)),
    });
  },
);

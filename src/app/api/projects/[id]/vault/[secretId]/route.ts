import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function canAccess(userId: string, role: string, projectId: string): Promise<boolean> {
  if (role === "CLIENT") return false;
  if (["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(role)) return true;
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    select: { id: true },
  });
  return !!member;
}

export const DELETE = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id");
    const role = req.headers.get("x-user-role") ?? "";
    if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

    const projectId = ctx?.params.id;
    const secretId = ctx?.params.secretId;
    if (!projectId || !secretId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    if (!(await canAccess(userId, role, projectId))) forbidden();

    const existing = await prisma.projectSecret.findUnique({
      where: { id: secretId },
      select: { projectId: true, key: true },
    });
    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }

    await prisma.projectSecret.delete({ where: { id: secretId } });
    await logAction(userId, "VAULT_SECRET_DELETED", "ProjectSecret", secretId, { key: existing.key });

    return NextResponse.json({ data: { id: secretId } });
  },
);

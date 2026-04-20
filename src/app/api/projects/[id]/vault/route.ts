import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Anyone with project access can READ the vault.
async function canRead(userId: string, role: string, projectId: string): Promise<boolean> {
  if (["ADMIN", "PROJECT_MANAGER"].includes(role)) return true;
  // CLIENT is the project's client?
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } });
  if (project?.clientId === userId) return true;
  // Or a project member
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    select: { id: true },
  });
  return !!member;
}

// Admins, managers, and clients can add/update secrets.
async function canWrite(userId: string, role: string, projectId: string): Promise<boolean> {
  if (["ADMIN", "PROJECT_MANAGER"].includes(role)) return true;
  if (role === "CLIENT") {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } });
    return project?.clientId === userId;
  }
  return false;
}

const CreateSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.string().min(1),
  description: z.string().max(500).optional().nullable(),
});

export const GET = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id");
    const role = req.headers.get("x-user-role") ?? "";
    if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

    const projectId = ctx?.params.id;
    if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    if (!(await canRead(userId, role, projectId))) forbidden();

    const secrets = await prisma.projectSecret.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        key: true,
        value: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: secrets });
  },
);

export const POST = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id");
    const role = req.headers.get("x-user-role") ?? "";
    if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

    const projectId = ctx?.params.id;
    if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    if (!(await canWrite(userId, role, projectId))) forbidden();

    const body = CreateSchema.parse(await req.json());

    const created = await prisma.projectSecret.upsert({
      where: { projectId_key: { projectId, key: body.key } },
      update: { value: body.value, description: body.description ?? null },
      create: {
        projectId,
        key: body.key,
        value: body.value,
        description: body.description ?? null,
        createdById: userId,
      },
    });

    await logAction(userId, "VAULT_SECRET_SAVED", "ProjectSecret", created.id, { key: body.key });
    return NextResponse.json({ data: created }, { status: 201 });
  },
);

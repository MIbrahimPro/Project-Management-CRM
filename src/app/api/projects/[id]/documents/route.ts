import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

type DocAccessFilter =
  | { projectId: string; OR: { access: string }[] }
  | { projectId: string; access: "PRIVATE"; ownerId: string }
  | { projectId: string };

function buildAccessWhere(
  projectId: string,
  userId: string,
  isClient: boolean,
  isManager: boolean
): DocAccessFilter {
  if (isManager) return { projectId };
  if (isClient) {
    return {
      projectId,
      OR: [{ access: "CLIENT_VIEW" }, { access: "CLIENT_EDIT" }],
    };
  }
  // Team member: see INTERNAL + CLIENT_VIEW/EDIT + own PRIVATE docs
  return {
    projectId,
    OR: [
      { access: "INTERNAL" },
      { access: "CLIENT_VIEW" },
      { access: "CLIENT_EDIT" },
      // own private docs — handled via separate OR below
    ],
  } as DocAccessFilter;
}

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
    const isManager = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(role);
    if (!member && !isClient && !isManager) forbidden();

    let docs;
    if (isManager) {
      docs = await prisma.document.findMany({
        where: { projectId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          docType: true,
          access: true,
          milestoneId: true,
          parentId: true,
          ownerId: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
          milestone: { select: { id: true, order: true, title: true } },
        },
      });
    } else if (isClient) {
      docs = await prisma.document.findMany({
        where: {
          projectId,
          access: { in: ["CLIENT_VIEW", "CLIENT_EDIT"] },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          docType: true,
          access: true,
          milestoneId: true,
          parentId: true,
          ownerId: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
          milestone: { select: { id: true, order: true, title: true } },
        },
      });
    } else {
      // Team member: INTERNAL + CLIENT_VIEW/EDIT + own PRIVATE
      docs = await prisma.document.findMany({
        where: {
          projectId,
          OR: [
            { access: { in: ["INTERNAL", "CLIENT_VIEW", "CLIENT_EDIT"] } },
            { access: "PRIVATE", ownerId: userId },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          docType: true,
          access: true,
          milestoneId: true,
          parentId: true,
          ownerId: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
          milestone: { select: { id: true, order: true, title: true } },
        },
      });
    }

    return NextResponse.json({ data: docs });
  }
);

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  docType: z.string().default("custom"),
  access: z.enum(["PRIVATE", "INTERNAL", "CLIENT_VIEW", "CLIENT_EDIT"]).default("INTERNAL"),
  milestoneId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

export const POST = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Clients cannot create documents
    if (role === "CLIENT") forbidden();

    const body = CreateSchema.parse(await req.json());
    const isPrivate = body.access === "PRIVATE";

    const doc = await prisma.document.create({
      data: {
        projectId,
        title: body.title,
        docType: body.docType,
        access: body.access,
        milestoneId: body.milestoneId ?? null,
        parentId: body.parentId ?? null,
        ownerId: isPrivate ? userId : null,
        createdById: userId,
      },
    });

    await logAction(userId, "DOCUMENT_CREATED", "Document", doc.id);
    return NextResponse.json({ data: doc }, { status: 201 });
  }
);

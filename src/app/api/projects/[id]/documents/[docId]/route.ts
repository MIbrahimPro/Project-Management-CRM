import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  access: z.enum(["PRIVATE", "INTERNAL", "CLIENT_VIEW", "CLIENT_EDIT"]).optional(),
});

function isManagerRole(role: string) {
  return ["ADMIN", "PROJECT_MANAGER"].includes(role);
}

export const GET = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    const docId = ctx?.params.docId;
    if (!projectId || !docId)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const doc = await prisma.document.findUnique({
      where: { id: docId },
      include: {
        milestone: { select: { id: true, order: true, title: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!doc || doc.projectId !== projectId)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Access check
    if (doc.access === "PRIVATE" && doc.ownerId !== userId) forbidden();
    if (!isManagerRole(role)) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { clientId: true },
      });
      const isClient = project?.clientId === userId;
      if (isClient && !["CLIENT_VIEW", "CLIENT_EDIT"].includes(doc.access)) forbidden();
    }

    return NextResponse.json({ data: doc });
  }
);

export const PATCH = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    const docId = ctx?.params.docId;
    if (!projectId || !docId)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { ownerId: true, docType: true, access: true },
    });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only managers can change access; owners or managers can change title
    const body = PatchSchema.parse(await req.json());

    if (body.access && !isManagerRole(role)) forbidden();
    if (body.title && !isManagerRole(role) && doc.ownerId !== userId) forbidden();

    const updated = await prisma.document.update({
      where: { id: docId },
      data: body,
    });

    await logAction(userId, "DOCUMENT_UPDATED", "Document", docId);
    return NextResponse.json({ data: updated });
  }
);

export const DELETE = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    const docId = ctx?.params.docId;
    if (!projectId || !docId)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });

    // Only managers can delete
    if (!isManagerRole(role)) forbidden();

    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { docType: true, projectId: true },
    });
    if (!doc || doc.projectId !== projectId)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // System docs cannot be deleted
    if (doc.docType === "requirements") {
      return NextResponse.json({ error: "Cannot delete system documents" }, { status: 400 });
    }

    await prisma.document.delete({ where: { id: docId } });
    await logAction(userId, "DOCUMENT_DELETED", "Document", docId);

    return NextResponse.json({ success: true });
  }
);

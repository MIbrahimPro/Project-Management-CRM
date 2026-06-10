import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import type { Server } from "socket.io";
import { uploadFile, deleteFile } from "@/lib/storage/supabase-storage";

declare global {
  var io: Server;
}

export const dynamic = "force-dynamic";

// GET - List client's own project requests (only PENDING - ACCEPTED ones become projects)
export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const role = req.headers.get("x-user-role") ?? "";
  
  if (role !== "CLIENT") forbidden();

  const requests = await prisma.clientProjectRequest.findMany({
    where: { clientId: userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: requests });
});

// PATCH - Update a request (only if still PENDING)
const UpdateSchema = z.object({
  id: z.string(),
  title: z.string().min(2).max(200).optional(),
  description: z.string().min(10).optional(),
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const role = req.headers.get("x-user-role") ?? "";

  if (role !== "CLIENT") forbidden();

  // Handle both JSON and FormData
  const contentType = req.headers.get("content-type") ?? "";
  let id: string;
  let title: string | undefined;
  let description: string | undefined;
  let pdf: File | null = null;
  let deletePdf = false;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    id = form.get("id") as string;
    title = form.get("title") as string | undefined;
    description = form.get("description") as string | undefined;
    pdf = form.get("pdf") as File | null;
    deletePdf = form.get("deletePdf") === "true";
  } else {
    const body = UpdateSchema.parse(await req.json());
    id = body.id;
    title = body.title;
    description = body.description;
  }

  const existing = await prisma.clientProjectRequest.findFirst({
    where: { id, clientId: userId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (existing.status !== "PENDING") {
    return NextResponse.json(
      { error: "Cannot edit request that is already being processed" },
      { status: 400 }
    );
  }

  let pdfUrl = existing.pdfUrl;

  // Handle PDF deletion
  if (deletePdf && existing.pdfUrl) {
    try {
      await deleteFile(existing.pdfUrl);
    } catch (e) {
      console.log("Failed to delete old PDF, continuing anyway");
    }
    pdfUrl = null;
  }

  // Handle new file upload
  const ALLOWED_TYPES: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/markdown": ".md",
    "text/plain": ".txt",
  };

  if (pdf instanceof File && pdf.size > 0) {
    const ext = ALLOWED_TYPES[pdf.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Only PDF, DOCX, MD, and TXT files allowed", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    if (pdf.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be under 5MB", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Delete old file if exists
    if (existing.pdfUrl) {
      try {
        await deleteFile(existing.pdfUrl);
      } catch (e) {
        console.log("Failed to delete old file, continuing anyway");
      }
    }

    const buffer = Buffer.from(await pdf.arrayBuffer());
    const path = `project-briefs/${userId}-${Date.now()}${ext}` as const;
    await uploadFile(buffer, path, pdf.type);
    pdfUrl = path;
  }

  const updated = await prisma.clientProjectRequest.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(description && { description }),
      pdfUrl,
    },
  });

  // Notify managers about the update
  if (global.io) {
    global.io.of("/projects").emit("request_updated", { request: updated });
  }

  return NextResponse.json({ data: updated });
});

// DELETE - Delete a request (only if still PENDING)
const DeleteSchema = z.object({
  id: z.string(),
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const role = req.headers.get("x-user-role") ?? "";
  
  if (role !== "CLIENT") forbidden();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.clientProjectRequest.findFirst({
    where: { id, clientId: userId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (existing.status !== "PENDING") {
    return NextResponse.json(
      { error: "Cannot delete request that is already being processed" },
      { status: 400 }
    );
  }

  await prisma.clientProjectRequest.delete({
    where: { id },
  });

  // Notify managers about the deletion
  if (global.io) {
    global.io.of("/projects").emit("request_deleted", { requestId: id });
  }

  return NextResponse.json({ success: true });
});

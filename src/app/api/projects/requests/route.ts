import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { uploadFile } from "@/lib/storage/supabase-storage";
import { sendNotification } from "@/lib/notifications/notify";
import { logAction } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

const Schema = z.object({
  title: z.string().min(3, "Title too short").max(200, "Title too long"),
  description: z.string().min(10, "Description too short"),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const role = req.headers.get("x-user-role") ?? "";
  if (role !== "CLIENT") forbidden();

  const form = await req.formData();
  const title = (form.get("title") as string | null) ?? "";
  const description = (form.get("description") as string | null) ?? "";
  const pdf = form.get("pdf");

  Schema.parse({ title, description });

  const ALLOWED_TYPES: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/markdown": ".md",
    "text/plain": ".txt",
  };

  let pdfUrl: string | null = null;
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
    const buffer = Buffer.from(await pdf.arrayBuffer());
    const path = `project-briefs/${userId}-${Date.now()}${ext}` as const;
    await uploadFile(buffer, path, pdf.type);
    pdfUrl = path;
  }

  const request = await prisma.clientProjectRequest.create({
    data: { clientId: userId, title, description, pdfUrl },
  });

  await logAction(userId, "PROJECT_REQUEST_SUBMITTED", "ClientProjectRequest", request.id);

  // Notify all admins and project managers
  const managers = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "PROJECT_MANAGER"] }, isActive: true },
    select: { id: true },
  });
  await Promise.all(
    managers.map((m) =>
      sendNotification(
        m.id,
        "PROJECT_UPDATE",
        "New Project Request",
        `A client has submitted a new project request: **${title}**`,
        "/projects"
      )
    )
  );

  return NextResponse.json({ data: request }, { status: 201 });
});

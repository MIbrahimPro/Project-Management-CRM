import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { getSignedUrl } from "@/lib/storage/supabase-storage";

const pdfParseModule = require("pdf-parse");
const pdfParse = pdfParseModule.default || pdfParseModule;
const mammoth = require("mammoth");

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requestId = ctx?.params?.id;
  if (!requestId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const request = await prisma.clientProjectRequest.findUnique({
    where: { id: requestId },
  });

  if (!request || !request.pdfUrl) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (role === "CLIENT" && request.clientId !== userId) {
    forbidden();
  }

  const signedUrl = await getSignedUrl(request.pdfUrl, 3600);
  const lower = request.pdfUrl.toLowerCase();

  let fileType: "pdf" | "md" | "txt" | "docx" = "pdf";
  let textContent: string | null = null;

  if (lower.endsWith(".md")) {
    fileType = "md";
    try {
      const res = await fetch(signedUrl);
      if (res.ok) textContent = await res.text();
    } catch { /* ignore */ }
  } else if (lower.endsWith(".txt")) {
    fileType = "txt";
    try {
      const res = await fetch(signedUrl);
      if (res.ok) textContent = await res.text();
    } catch { /* ignore */ }
  } else if (lower.endsWith(".docx")) {
    fileType = "docx";
    try {
      const res = await fetch(signedUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const result = await mammoth.extractRawText({ buffer });
        textContent = result.value;
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    data: { url: signedUrl, fileType, textContent },
  });
});

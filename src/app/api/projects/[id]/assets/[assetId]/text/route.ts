import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSignedUrl } from "@/lib/storage/supabase-storage";

const mammoth = require("mammoth");

export const dynamic = "force-dynamic";

const TEXT_TYPES = ["text/markdown", "text/plain", "text/csv", "application/json", "text/html", "text/css", "application/javascript", "application/typescript"];
const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];

export const GET = async (req: NextRequest, ctx: { params: Record<string, string> }) => {
  try {
    const userId = req.headers.get("x-user-id");
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx.params.id;
    const assetId = ctx.params.assetId;

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!projectId || !assetId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        project: {
          select: {
            members: { where: { userId }, select: { id: true } },
            projectClients: { where: { clientId: userId }, select: { id: true } },
            clientId: true,
          },
        },
      },
    });

    if (!asset || asset.projectId !== projectId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isManager = MANAGER_ROLES.includes(role);
    const isMember = asset.project.members.length > 0;
    const isClient = asset.project.clientId === userId || asset.project.projectClients.length > 0;

    if (!isManager && !isMember && !isClient) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isClient && !asset.isVisibleToClient && asset.uploadedById !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if this is a previewable text type
    const lower = asset.name.toLowerCase();
    const isDocx = lower.endsWith(".docx") || asset.fileType.includes("wordprocessingml.document");
    const isPreviewable = isDocx || TEXT_TYPES.includes(asset.fileType) || lower.endsWith(".md") || lower.endsWith(".txt");

    if (!isPreviewable) {
      return NextResponse.json({ error: "Not a text-previewable file" }, { status: 400 });
    }

    const signedUrl = await getSignedUrl(asset.fileUrl, 300);
    const response = await fetch(signedUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });
    }

    let textContent: string;

    if (isDocx) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      textContent = result.value;
    } else {
      textContent = await response.text();
    }

    // Limit preview size
    if (textContent.length > 50000) {
      textContent = textContent.slice(0, 50000) + "\n\n... (truncated)";
    }

    return NextResponse.json({
      data: {
        text: textContent,
        isMarkdown: lower.endsWith(".md") || asset.fileType === "text/markdown",
        name: asset.name,
      },
    });
  } catch (e) {
    console.error("[asset-text] Error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
};

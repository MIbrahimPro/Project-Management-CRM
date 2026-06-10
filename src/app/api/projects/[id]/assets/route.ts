import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/db/audit";
import type { Server } from "socket.io";

declare global {
  var io: Server;
}

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];

// Helper to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// GET - List assets with visibility rules
export const GET = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Check project membership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { select: { userId: true } }, projectClients: { select: { clientId: true } } },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const isManager = MANAGER_ROLES.includes(role);
    const isProjectMember = project.members.some((m) => m.userId === userId);
    const isClient = role === "CLIENT";
    const isProjectClient = project.projectClients.some((pc) => pc.clientId === userId);

    // Clients must be project clients, others must be members
    if (isClient && !isProjectClient) forbidden();
    if (!isClient && !isProjectMember && !isManager) forbidden();

    // Build where clause based on role
    let where: any = { projectId };
    
    if (isClient) {
      // Client only sees assets marked visible OR uploaded by themselves
      where = {
        projectId,
        OR: [
          { isVisibleToClient: true },
          { uploadedById: userId },
        ],
      };
    }
    // Managers and team members see all assets

    const assets = await prisma.asset.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: assets.map((a) => ({
        ...a,
        fileSizeFormatted: formatFileSize(a.fileSize),
      })),
    });
  }
);

// POST - Upload asset
export const POST = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    if (!projectId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Check membership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { select: { userId: true } }, projectClients: { select: { clientId: true } } },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const isManager = MANAGER_ROLES.includes(role);
    const isProjectMember = project.members.some((m) => m.userId === userId);
    const isClient = role === "CLIENT";
    const isProjectClient = project.projectClients.some((pc) => pc.clientId === userId);

    if (isClient && !isProjectClient) forbidden();
    if (!isClient && !isProjectMember && !isManager) forbidden();

    const body = await req.json();
    const { name, fileUrl, fileType, fileSize } = body;

    if (!name || !fileUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Detect MIME type from extension if browser didn't provide one
    let resolvedFileType = fileType || "";
    if (!resolvedFileType || resolvedFileType === "application/octet-stream") {
      const ext = name.split(".").pop()?.toLowerCase();
      if (ext === "md") resolvedFileType = "text/markdown";
      else if (ext === "txt") resolvedFileType = "text/plain";
      else if (ext === "docx") resolvedFileType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (ext === "pdf") resolvedFileType = "application/pdf";
      else if (ext === "csv") resolvedFileType = "text/csv";
      else if (ext === "json") resolvedFileType = "application/json";
      else if (ext === "html" || ext === "htm") resolvedFileType = "text/html";
      else if (ext === "css") resolvedFileType = "text/css";
      else if (ext === "js") resolvedFileType = "application/javascript";
      else if (ext === "ts") resolvedFileType = "application/typescript";
      else if (ext === "svg") resolvedFileType = "image/svg+xml";
      else if (ext === "png") resolvedFileType = "image/png";
      else if (ext === "jpg" || ext === "jpeg") resolvedFileType = "image/jpeg";
      else if (ext === "gif") resolvedFileType = "image/gif";
      else if (ext === "webp") resolvedFileType = "image/webp";
      else if (ext === "mp4") resolvedFileType = "video/mp4";
      else if (ext === "mp3") resolvedFileType = "audio/mpeg";
    }
    if (!resolvedFileType) resolvedFileType = "application/octet-stream";

    // Client uploads are instantly visible to everyone
    // Team uploads are NOT visible to client by default
    const isVisibleToClient = isClient;

    const asset = await prisma.asset.create({
      data: {
        projectId,
        name,
        fileUrl,
        fileType: resolvedFileType,
        fileSize: fileSize || 0,
        uploadedById: userId,
        isVisibleToClient,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, role: true } },
      },
    });

    await logAction(userId, "ASSET_UPLOADED", "Asset", asset.id, {
      projectId,
      fileName: name,
      isVisibleToClient,
    });

    // Emit real-time update
    if (global.io) {
      const assetWithFormatted = { ...asset, fileSizeFormatted: formatFileSize(asset.fileSize) };
      global.io
        .of("/chat")
        .to(`project:${projectId}`)
        .emit("asset_created", { asset: assetWithFormatted });
    }

    return NextResponse.json({
      data: { ...asset, fileSizeFormatted: formatFileSize(asset.fileSize) },
    });
  }
);

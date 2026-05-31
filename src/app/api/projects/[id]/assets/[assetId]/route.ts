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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// PATCH - Toggle visibility to client (manager/admin only)
export const PATCH = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    const assetId = ctx?.params.assetId;
    
    if (!projectId || !assetId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // Only managers/admins can toggle visibility
    if (!MANAGER_ROLES.includes(role)) forbidden();

    const body = await req.json();
    const { isVisibleToClient } = body;

    const asset = await prisma.asset.update({
      where: { id: assetId, projectId },
      data: { isVisibleToClient },
      include: {
        uploadedBy: { select: { id: true, name: true, role: true } },
      },
    });

    await logAction(userId, isVisibleToClient ? "ASSET_VISIBLE_TO_CLIENT" : "ASSET_HIDDEN_FROM_CLIENT", "Asset", assetId, {
      projectId,
      fileName: asset.name,
    });

    // Emit real-time update
    if (global.io) {
      const assetWithFormatted = { ...asset, fileSizeFormatted: formatFileSize(asset.fileSize) };
      global.io
        .of("/chat")
        .to(`project:${projectId}`)
        .emit("asset_updated", { asset: assetWithFormatted });
    }

    return NextResponse.json({ data: asset });
  }
);

// DELETE - Delete asset (owner or manager/admin)
export const DELETE = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    const projectId = ctx?.params.id;
    const assetId = ctx?.params.assetId;
    
    if (!projectId || !assetId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const isManager = MANAGER_ROLES.includes(role);

    // Find asset to check ownership
    const asset = await prisma.asset.findUnique({
      where: { id: assetId, projectId },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Only owner or manager can delete
    if (!isManager && asset.uploadedById !== userId) {
      forbidden();
    }

    await prisma.asset.delete({
      where: { id: assetId },
    });

    await logAction(userId, "ASSET_DELETED", "Asset", assetId, {
      projectId,
      fileName: asset.name,
    });

    // Emit real-time update
    if (global.io) {
      global.io
        .of("/chat")
        .to(`project:${projectId}`)
        .emit("asset_deleted", { assetId, projectId });
    }

    return NextResponse.json({ success: true });
  }
);

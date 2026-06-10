import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSignedUrl } from "@/lib/storage/supabase-storage";

export const dynamic = "force-dynamic";

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

    const signedUrl = await getSignedUrl(asset.fileUrl, 300);
    const response = await fetch(signedUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") ?? asset.fileType ?? "application/octet-stream";
    const contentDisposition = `inline; filename="${encodeURIComponent(asset.name)}"`;

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("[asset-file] Proxy error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
};

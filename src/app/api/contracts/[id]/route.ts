import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { getSignedUrl } from "@/lib/supabase-storage";

const CONTRACT_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "HR"];

/**
 * GET /api/contracts/[id]
 * Get contract details with versions and signed URL for latest.
 */
export const GET = apiHandler(async (req: NextRequest, { params }: any) => {
  const userId = req.headers.get("x-user-id")!;
  const userRole = req.headers.get("x-user-role")!;

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          profilePicUrl: true,
        },
      },
      versions: {
        orderBy: { version: "desc" },
        include: {
          uploadedBy: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Check access
  const isOwner = contract.userId === userId;
  const isManager = CONTRACT_ROLES.includes(userRole);

  if (!isOwner && !isManager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Add signed URLs to versions
  const versionsWithUrls = await Promise.all(
    contract.versions.map(async (v) => ({
      ...v,
      url: await getSignedUrl(v.storagePath).catch(() => null),
    }))
  );

  return NextResponse.json({
    data: {
      ...contract,
      versions: versionsWithUrls,
    },
  });
});

/**
 * PATCH /api/contracts/[id]
 * Update title or status.
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }: any) => {
  const userRole = req.headers.get("x-user-role")!;

  if (!CONTRACT_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { title, status } = body;

  const contract = await prisma.contract.update({
    where: { id: params.id },
    data: {
      title,
      status,
    },
  });

  return NextResponse.json({ data: contract });
});

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { uploadFile } from "@/lib/supabase-storage";
import { nanoid } from "nanoid";
import { z } from "zod";

const CONTRACT_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "HR"];

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id")!;
  const userRole = req.headers.get("x-user-role")!;
  const isManager = CONTRACT_ROLES.includes(userRole);

  if (!isManager) {
    const contracts = await prisma.contract.findMany({
      where: { userId },
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
          include: {
            uploadedBy: { select: { id: true, name: true } },
          },
          orderBy: { version: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ data: contracts });
  }

  // Manager/HR view: show all employees and their contracts
  const employees = await prisma.user.findMany({
    where: {
      role: { notIn: ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "CLIENT"] },
      isActive: true,
    },
    include: {
      contracts: {
        include: {
          versions: {
            include: {
              uploadedBy: { select: { id: true, name: true } },
            },
            orderBy: { version: "desc" },
          },
        },
        take: 1, // Since it's unique, there's only 1 anyway
      },
    },
    orderBy: { name: "asc" },
  });

  const data = employees.map((e) => {
    const contract = e.contracts[0];
    return {
      id: contract?.id || `missing-${e.id}`,
      userId: e.id,
      user: {
        id: e.id,
        name: e.name,
        email: e.email,
        role: e.role,
        profilePicUrl: e.profilePicUrl,
      },
      title: contract?.title || "Missing Contract",
      currentVersion: contract?.currentVersion || 0,
      status: contract?.status || "MISSING",
      updatedAt: contract?.updatedAt || e.createdAt,
      versions: contract?.versions || [],
      isMissing: !contract,
    };
  });

  return NextResponse.json({ data });
});

/**
 * POST /api/contracts
 * Create a new contract (upload first version).
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const creatorId = req.headers.get("x-user-id")!;
  const userRole = req.headers.get("x-user-role")!;

  if (!CONTRACT_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await req.formData();
  const userId = formData.get("userId") as string;
  const title = formData.get("title") as string;
  const file = formData.get("file") as File;

  if (!userId || !title || !file) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileExt = file.name.split(".").pop();
  const storagePath = `contracts/${userId}_${nanoid()}.${fileExt}` as const;

  await uploadFile(buffer, storagePath, file.type);

  const contract = await prisma.$transaction(async (tx) => {
    const existing = await tx.contract.findUnique({ where: { userId } });
    const nextVersion = existing ? existing.currentVersion + 1 : 1;

    const updated = await tx.contract.upsert({
      where: { userId },
      create: {
        userId,
        title,
        currentVersion: 1,
        status: "PENDING",
      },
      update: {
        title,
        currentVersion: nextVersion,
        status: "PENDING",
      },
    });

    await tx.contractVersion.create({
      data: {
        contractId: updated.id,
        version: nextVersion,
        storagePath,
        uploadedById: creatorId,
      },
    });

    return updated;
  });

  // Notify user (Chunk 14.7)
  const { sendNotification } = await import("@/lib/notify");
  await sendNotification(
    userId,
    "GENERAL",
    "New Contract Uploaded",
    `A new version of your contract "${title}" is ready for review.`,
    "/profile"
  );

  return NextResponse.json({ data: contract });
});

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { uploadFile } from "@/lib/supabase-storage";
import { nanoid } from "nanoid";

const CONTRACT_ROLES = ["ADMIN", "PROJECT_MANAGER", "HR"];

/**
 * POST /api/contracts/[id]/versions
 * Upload a new version for an existing contract.
 */
export const POST = apiHandler(async (req: NextRequest, { params }: any) => {
  const creatorId = req.headers.get("x-user-id")!;
  const userRole = req.headers.get("x-user-role")!;

  if (!CONTRACT_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const newVersionNumber = contract.currentVersion + 1;
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileExt = file.name.split(".").pop();
  const storagePath = `contracts/${contract.userId}_v${newVersionNumber}_${nanoid()}.${fileExt}` as const;

  await uploadFile(buffer, storagePath, file.type);

  const updatedContract = await prisma.$transaction(async (tx) => {
    await tx.contractVersion.create({
      data: {
        contractId: contract.id,
        version: newVersionNumber,
        storagePath,
        uploadedById: creatorId,
      },
    });

    return tx.contract.update({
      where: { id: contract.id },
      data: {
        currentVersion: newVersionNumber,
        status: "PENDING",
      },
    });
  });

  return NextResponse.json({ data: updatedContract });
});

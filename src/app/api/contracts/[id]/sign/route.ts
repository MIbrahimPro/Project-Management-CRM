import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/contracts/[id]/sign
 * Employee signs their own contract.
 */
export const POST = apiHandler(async (req: NextRequest, { params }: any) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: { user: true },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found", code: "NOT_FOUND" }, { status: 404 });
  }

  if (contract.userId !== userId) {
    return NextResponse.json({ error: "You can only sign your own contract", code: "FORBIDDEN" }, { status: 403 });
  }

  if (contract.status === "SIGNED") {
    return NextResponse.json({ error: "Contract already signed", code: "ALREADY_SIGNED" }, { status: 400 });
  }

  const updated = await prisma.contract.update({
    where: { id: params.id },
    data: { status: "SIGNED" },
  });

  await logAction(userId, "CONTRACT_SIGNED", "Contract", params.id, { version: contract.currentVersion }, ip);

  return NextResponse.json({ data: updated });
});

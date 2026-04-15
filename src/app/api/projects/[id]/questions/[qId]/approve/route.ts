import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const PATCH = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const role = req.headers.get("x-user-role") ?? "";
    if (!["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

    const qId = ctx?.params.qId;
    if (!qId) return NextResponse.json({ error: "Missing qId" }, { status: 400 });

    await prisma.projectQuestion.update({
      where: { id: qId },
      data: { isApproved: true },
    });

    await logAction(userId, "QUESTION_APPROVED", "ProjectQuestion", qId);

    return NextResponse.json({ success: true });
  }
);

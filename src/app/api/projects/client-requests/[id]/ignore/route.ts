import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const PATCH = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const role = req.headers.get("x-user-role") ?? "";
    if (!["ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

    const id = ctx?.params.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.clientProjectRequest.update({
      where: { id },
      data: { status: "IGNORED" },
    });

    return NextResponse.json({ success: true });
  }
);

import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const role = req.headers.get("x-user-role") ?? "";
    if (!["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

    const id = ctx?.params.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const request = await prisma.clientProjectRequest.findUnique({ where: { id } });
    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const client = await prisma.user.findUnique({
      where: { id: request.clientId },
      select: { id: true, name: true, profilePicUrl: true },
    });

    return NextResponse.json({ data: { ...request, client } });
  }
);

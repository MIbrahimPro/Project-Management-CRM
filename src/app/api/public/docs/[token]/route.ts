import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const token = ctx?.params?.token;
  if (!token) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const doc = await prisma.document.findUnique({
    where: { shareToken: token, isShared: true },
    select: {
      id: true,
      title: true,
      content: true,
      updatedAt: true,
      project: {
        select: { title: true },
      },
    },
  });

  if (!doc) {
    return NextResponse.json(
      { error: "Document not found or no longer shared", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: doc });
});

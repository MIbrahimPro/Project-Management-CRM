import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { nanoid } from "nanoid";

export const POST = apiHandler(async (req: NextRequest, ctx) => {
  const projectId = ctx?.params?.id;
  const docId = ctx?.params?.docId;
  if (!projectId || !docId) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const { action } = (await req.json()) as { action: "enable" | "disable" | "regenerate" };

  const doc = await prisma.document.findUnique({
    where: { id: docId, projectId },
    select: { id: true, isShared: true, shareToken: true },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found", code: "NOT_FOUND" }, { status: 404 });
  }

  let data: { isShared?: boolean; shareToken?: string } = {};
  if (action === "enable") {
    data = { isShared: true, shareToken: doc.shareToken || nanoid(12) };
  } else if (action === "disable") {
    data = { isShared: false };
  } else if (action === "regenerate") {
    data = { shareToken: nanoid(12) };
  }

  const updated = await prisma.document.update({
    where: { id: docId },
    data,
  });

  return NextResponse.json({ data: updated });
});

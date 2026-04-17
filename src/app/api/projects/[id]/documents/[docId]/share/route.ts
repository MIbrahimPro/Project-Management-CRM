import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { nanoid } from "nanoid";

export const POST = apiHandler(async (req: NextRequest, { params }: any) => {
  const { id: projectId, docId } = params;
  const { action } = await req.json() as { action: "enable" | "disable" | "regenerate" };

  const doc = await prisma.document.findUnique({
    where: { id: docId, projectId },
    select: { id: true, isShared: true, shareToken: true }
  });

  if (!doc) return { status: 404, error: "Document not found" };

  let data: any = {};
  if (action === "enable") {
    data = { isShared: true, shareToken: doc.shareToken || nanoid(12) };
  } else if (action === "disable") {
    data = { isShared: false };
  } else if (action === "regenerate") {
    data = { shareToken: nanoid(12) };
  }

  const updated = await prisma.document.update({
    where: { id: docId },
    data
  });

  return { data: updated };
});

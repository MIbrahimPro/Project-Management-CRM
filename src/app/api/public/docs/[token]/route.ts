import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest, { params }: any) => {
  const { token } = params;

  const doc = await prisma.document.findUnique({
    where: { shareToken: token, isShared: true },
    select: {
      id: true,
      title: true,
      content: true,
      updatedAt: true,
      project: {
        select: { name: true }
      }
    }
  });

  if (!doc) return { status: 404, error: "Document not found or no longer shared" };

  return { data: doc };
});

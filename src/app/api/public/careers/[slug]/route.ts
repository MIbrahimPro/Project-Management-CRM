import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: { slug: string } }) {
  const { slug } = ctx.params;

  const request = await prisma.hiringRequest.findUnique({
    where: { publicSlug: slug, status: "OPEN" },
    select: {
      id: true,
      statedRole: true,
      publicTitle: true,
      publicDescription: true,
      deadline: true,
      questions: {
        orderBy: { order: "asc" },
        select: { id: true, text: true, required: true, order: true },
      },
    },
  });

  if (!request) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ data: request });
}

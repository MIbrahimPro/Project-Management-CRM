import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import dayjs from "dayjs";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  // Group by human-readable date label
  const today = dayjs().startOf("day");
  const yesterday = today.subtract(1, "day");
  const groups: Record<string, typeof notifications> = {};

  for (const n of notifications) {
    const d = dayjs(n.createdAt);
    let label: string;
    if (d.isAfter(today)) label = "Today";
    else if (d.isAfter(yesterday)) label = "Yesterday";
    else label = d.format("MMMM D, YYYY");

    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }

  return NextResponse.json({ data: { notifications, groups, total, page, limit } });
});

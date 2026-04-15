import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();

  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return NextResponse.json({ data: { hasUnread: count > 0, count } });
});

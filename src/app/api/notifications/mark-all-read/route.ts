import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();

  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  if (global.io) {
    global.io.of("/notifications").to(`user:${userId}`).emit("has_unread", false);
  }

  return NextResponse.json({ success: true });
});

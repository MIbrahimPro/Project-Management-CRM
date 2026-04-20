import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden, notFound } from "@/lib/api-handler";
import type { Server as SocketIOServer } from "socket.io";

export const dynamic = "force-dynamic";

export const DELETE = apiHandler(async (req: NextRequest, { params }: any) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const userRole = req.headers.get("x-user-role") ?? "";

  const message = await prisma.message.findUnique({
    where: { id: params.id },
    select: { senderId: true, roomId: true },
  });

  if (!message) return notFound();

  // Only sender or Admin can delete for everyone
  // SUPER_ADMIN is hidden — they never reach normal APIs (middleware redirects to /control)
  const isOwner = message.senderId === userId;
  const isAdmin = userRole === "ADMIN";

  if (!isOwner && !isAdmin) {
    return forbidden();
  }

  await prisma.message.update({
    where: { id: params.id },
    data: {
      deletedAt: new Date(),
      deletedContent: null, // Optional: if we want to clear content completely
    },
  });

  // Emit to socket
  const io = (globalThis as unknown as { io?: SocketIOServer }).io;
  io?.of("/chat").to(`room:${message.roomId}`).emit("message_deleted", {
    messageId: params.id,
    roomId: message.roomId,
  });

  return NextResponse.json({ data: { success: true } });
});

import type { Server as SocketIOServer } from "socket.io";
import { prisma } from "./prisma";
import { sendNotification } from "./notify";

function getIo(): SocketIOServer | undefined {
  return (globalThis as unknown as { io?: SocketIOServer }).io;
}

const MESSAGE_INCLUDE = {
  sender: {
    select: {
      id: true,
      name: true,
      profilePicUrl: true,
      role: true,
      clientColor: true,
    },
  },
  replyTo: {
    select: {
      id: true,
      content: true,
      sender: { select: { name: true } },
    },
  },
  reactions: true,
  receipts: true,
  deliveredAt: true,
} as const;

export type ChatMessagePayload = {
  roomId: string;
  senderId: string;
  content: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  replyToId?: string | null;
};

/**
 * Persists a standard chat message (text and/or media), notifies members,
 * and broadcasts to the `/chat` Socket.io namespace when `global.io` is available.
 */
export async function createNormalChatMessage(params: ChatMessagePayload) {
  const message = await prisma.message.create({
    data: {
      roomId: params.roomId,
      senderId: params.senderId,
      content: params.content,
      mediaUrl: params.mediaUrl ?? null,
      mediaType: params.mediaType ?? null,
      replyToId: params.replyToId ?? undefined,
    },
    include: MESSAGE_INCLUDE,
  });

  const io = getIo();
  if (io) {
    io.of("/chat").to(`room:${params.roomId}`).emit("new_message", message);
  }

  const roomMembers = await prisma.chatRoomMember.findMany({
    where: { roomId: params.roomId, userId: { not: params.senderId } },
    select: { userId: true },
  });
  const room = await prisma.chatRoom.findUnique({
    where: { id: params.roomId },
    select: { name: true, type: true },
  });
  const preview =
    params.content?.trim().substring(0, 100) ||
    (params.mediaUrl ? "Media" : "New message");
  for (const m of roomMembers) {
    await sendNotification(
      m.userId,
      "CHAT_MESSAGE",
      room?.name || "New Message",
      preview,
      `/chat`
    );
  }

  return message;
}

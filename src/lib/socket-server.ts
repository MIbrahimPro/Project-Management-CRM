import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "./tokens";
import { setPresence, updateLastActive, setTyping, clearTyping } from "./redis";
import { prisma } from "./prisma";
import { createNormalChatMessage } from "./chat-send-message";
import { callAI } from "./ai";
import { parse as parseCookies } from "cookie";

export function setupSocketServer(io: Server) {
  
  // ============================================================
  // AUTH MIDDLEWARE (runs for ALL namespaces)
  // ============================================================
  const authMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
    const cookieHeader = socket.handshake.headers.cookie || "";
    const cookies = parseCookies(cookieHeader);
    const token = cookies["access_token"];
    
    if (!token) return next(new Error("Authentication required"));
    
    const payload = verifyAccessToken(token);
    if (!payload) return next(new Error("Invalid token"));
    
    socket.data.userId = payload.userId;
    socket.data.role = payload.role;
    next();
  };

  // ============================================================
  // /chat NAMESPACE
  // ============================================================
  const chatNS = io.of("/chat");
  chatNS.use(authMiddleware);

  chatNS.on("connection", async (socket) => {
    const userId = socket.data.userId as string;
    
    // Join all rooms the user is a member of
    const memberships = await prisma.chatRoomMember.findMany({
      where: { userId },
      select: { roomId: true },
    });
    for (const m of memberships) socket.join(`room:${m.roomId}`);

    void updateLastActive(userId);

    // ---- JOIN ROOM ----
    socket.on("join_room", async (roomId: string) => {
      const member = await prisma.chatRoomMember.findUnique({
        where: { roomId_userId: { roomId, userId } },
      });
      if (!member) return socket.emit("error", "Not a member of this room");
      socket.join(`room:${roomId}`);
    });

    // ---- SEND MESSAGE ----
    socket.on("send_message", async (data: {
      roomId: string;
      content?: string;
      mediaUrl?: string;
      mediaType?: string;
      replyToId?: string;
    }) => {
      try {
        void updateLastActive(userId);

        // Verify membership
        const member = await prisma.chatRoomMember.findUnique({
          where: { roomId_userId: { roomId: data.roomId, userId } },
        });
        if (!member) return;

        const content = data.content?.trim();

        // Media / voice: always persist as a normal message (do not run AI branches without media fields)
        if (data.mediaUrl && data.mediaType) {
          await createNormalChatMessage({
            roomId: data.roomId,
            senderId: userId,
            content: content || null,
            mediaUrl: data.mediaUrl,
            mediaType: data.mediaType,
            replyToId: data.replyToId,
          });
          return;
        }

        // Handle AI slash commands BEFORE saving to DB
        if (content?.startsWith("/professionalize ") || content?.startsWith("/email ")) {
          const isEmail = content.startsWith("/email ");
          const userMessage = content.replace(/^\/(professionalize|email) /, "");
          
          // Save original command message
          const originalMsg = await prisma.message.create({
            data: { roomId: data.roomId, senderId: userId, content },
            include: { sender: { select: { id: true, name: true, profilePicUrl: true } } },
          });
          chatNS.to(`room:${data.roomId}`).emit("new_message", originalMsg);

          // Get reply context if replying to a message
          let replyContext = "";
          if (data.replyToId) {
            const replyMsg = await prisma.message.findUnique({ where: { id: data.replyToId }, select: { content: true } });
            if (replyMsg?.content) replyContext = `\n\n[Replying to: "${replyMsg.content}"]`;
          }

          // Call AI
          const prompt = isEmail
            ? `Convert this into a professional email format with a subject line, greeting, body, and sign-off:${replyContext}\n\n${userMessage}`
            : `Rewrite this message to be professional and clear for workplace communication:${replyContext}\n\n${userMessage}`;

          const aiContent = await callAI([{ role: "user", content: prompt }]);
          const aiMsg = await prisma.message.create({
            data: { roomId: data.roomId, senderId: userId, content: aiContent, isAiResponse: true },
            include: { sender: { select: { id: true, name: true, profilePicUrl: true } } },
          });
          chatNS.to(`room:${data.roomId}`).emit("new_message", aiMsg);
          return;
        }

        // Handle @ai mention
        if (content?.includes("@ai")) {
          // Get last 20 messages for context
          const recentMessages = await prisma.message.findMany({
            where: { roomId: data.roomId, deletedAt: null, isAiResponse: false },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { content: true, sender: { select: { name: true } } },
          });
          
          const contextMessages = recentMessages.reverse().map(m => ({
            role: "user" as const,
            content: `${m.sender.name}: ${m.content}`,
          }));
          
          // Save original message first
          const userMsg = await prisma.message.create({
            data: { roomId: data.roomId, senderId: userId, content },
            include: { sender: { select: { id: true, name: true, profilePicUrl: true } } },
          });
          chatNS.to(`room:${data.roomId}`).emit("new_message", userMsg);
          
          const aiContent = await callAI(contextMessages, {
            systemPrompt: "You are an AI assistant in a team chat for DevRolin. Be helpful, concise, and professional. The user mentioning @ai is asking you directly.",
          });
          const aiMsg = await prisma.message.create({
            data: { roomId: data.roomId, senderId: userId, content: aiContent, isAiResponse: true },
            include: { sender: { select: { id: true, name: true, profilePicUrl: true } } },
          });
          chatNS.to(`room:${data.roomId}`).emit("new_message", aiMsg);
          return;
        }

        // Normal text message
        await createNormalChatMessage({
          roomId: data.roomId,
          senderId: userId,
          content: content || null,
          replyToId: data.replyToId,
        });

      } catch (err) {
        console.error("[Socket send_message error]", err);
      }
    });

    // ---- TYPING ----
    socket.on("typing_start", async (roomId: string) => {
      void setTyping(roomId, userId);
      socket.to(`room:${roomId}`).emit("user_typing", { userId, roomId });
    });
    socket.on("typing_stop", async (roomId: string) => {
      void clearTyping(roomId, userId);
      socket.to(`room:${roomId}`).emit("user_stopped_typing", { userId, roomId });
    });

    // ---- REACTIONS ----
    socket.on("react", async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      // Toggle reaction: if exists delete it, if not create it
      const existing = await prisma.messageReaction.findUnique({
        where: { messageId_userId_emoji: { messageId, userId, emoji } },
      });
      if (existing) {
        await prisma.messageReaction.delete({ where: { id: existing.id } });
      } else {
        await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
      }
      const reactions = await prisma.messageReaction.findMany({ where: { messageId } });
      const room = await prisma.message.findUnique({ where: { id: messageId }, select: { roomId: true } });
      if (room) chatNS.to(`room:${room.roomId}`).emit("message_reacted", { messageId, reactions });
    });

    // ---- MARK READ ----
    socket.on("mark_read", async (roomId: string) => {
      await prisma.chatRoomMember.updateMany({
        where: { roomId, userId },
        data: { lastReadAt: new Date() },
      });
    });

    // ---- DISCONNECT ----
    socket.on("disconnect", async () => {
      void setPresence(userId, "offline");
      chatNS.emit("presence_update", { userId, status: "offline" });
    });
  });

  // ============================================================
  // /presence NAMESPACE
  // ============================================================
  const presenceNS = io.of("/presence");
  presenceNS.use(authMiddleware);

  presenceNS.on("connection", async (socket) => {
    const userId = socket.data.userId as string;
    void setPresence(userId, "online");
    presenceNS.emit("presence_update", { userId, status: "online" });

    // Heartbeat: client sends ping every 30s
    socket.on("ping", async () => {
      void setPresence(userId, "online");
      void updateLastActive(userId);
    });

    socket.on("disconnect", async () => {
      void setPresence(userId, "offline");
      presenceNS.emit("presence_update", { userId, status: "offline" });
    });
  });

  // ============================================================
  // /notifications NAMESPACE
  // ============================================================
  const notifNS = io.of("/notifications");
  notifNS.use(authMiddleware);

  notifNS.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
  });

  // Export helper for use in API routes via global.io
  return { chatNS, presenceNS, notifNS };
}

import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "./tokens";
import { setPresence, updateLastActive, setTyping, clearTyping } from "./redis";
import { prisma } from "./prisma";
import { checkAutoCheckIn } from "./attendance-helpers";
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
      // Project questions rooms — just join, no membership check needed (auth middleware already verified user)
      if (roomId.startsWith("project_questions:")) {
        socket.join(roomId);
        return;
      }
      const member = await prisma.chatRoomMember.findUnique({
        where: { roomId_userId: { roomId, userId } },
      });
      if (!member) return socket.emit("error", "Not a member of this room");
      socket.join(`room:${roomId}`);
    });

    // ---- LEAVE ROOM ----
    socket.on("leave_room", (roomId: string) => {
      if (roomId.startsWith("project_questions:")) {
        socket.leave(roomId);
      }
    });

    // ---- QUESTION ACTION (relay to room) ----
    socket.on("question_action", (data: { room: string; type: string; payload: unknown }) => {
      if (!data?.room?.startsWith("project_questions:")) return;
      // Use namespace + except(sender) so delivery does not depend on relay quirks
      chatNS.to(data.room).except(socket.id).emit(data.type, data.payload);
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

        // Verify membership and fetch room/recipient details
        const member = await prisma.chatRoomMember.findUnique({
          where: { roomId_userId: { roomId: data.roomId, userId } },
          include: { 
            room: { 
              include: { 
                members: { 
                  include: { user: { select: { role: true } } } 
                } 
              } 
            } 
          },
        });
        if (!member) return;

        // Restriction: If there's a client in the room, only managers/admins can send messages
        // (unless the sender IS a client, but they can only be in rooms with managers)
        const hasClientInRoom = member.room.members.some(m => m.user.role === "CLIENT");
        const isSenderManager = ["ADMIN", "PROJECT_MANAGER"].includes(socket.data.role);
        const isSenderClient = socket.data.role === "CLIENT";

        if (hasClientInRoom && !isSenderManager && !isSenderClient) {
          return socket.emit("error", "Only managers and admins can communicate with clients.");
        }

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
      const now = new Date();
      await prisma.chatRoomMember.updateMany({
        where: { roomId, userId },
        data: { lastReadAt: now },
      });

      // Find unread messages to create receipts
      const unreadMessages = await prisma.message.findMany({
        where: {
          roomId,
          senderId: { not: userId },
          receipts: { none: { userId } },
          deletedAt: null,
        },
        select: { id: true },
        take: 50,
      });

      if (unreadMessages.length > 0) {
        await prisma.messageReceipt.createMany({
          data: unreadMessages.map(m => ({
            messageId: m.id,
            userId,
            readAt: now,
          })),
          skipDuplicates: true,
        });

        chatNS.to(`room:${roomId}`).emit("messages_read", {
          roomId,
          userId,
          messageIds: unreadMessages.map(m => m.id),
          readAt: now,
        });
      }
    });
    
    // ---- PIN MESSAGE ----
    socket.on("pin_message", async ({ messageId, isPinned }: { messageId: string; isPinned: boolean }) => {
      try {
        const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { roomId: true } });
        if (!msg) return;

        const member = await prisma.chatRoomMember.findUnique({
          where: { roomId_userId: { roomId: msg.roomId, userId } },
        });
        
        const isManager = ["ADMIN", "PROJECT_MANAGER"].includes(socket.data.role);
        const isRoomAdmin = member?.isGroupAdmin;

        if (!isManager && !isRoomAdmin) return;

        const updated = await prisma.message.update({
          where: { id: messageId },
          data: { pinnedAt: isPinned ? new Date() : null },
        });

        chatNS.to(`room:${msg.roomId}`).emit("message_pinned", { messageId, isPinned, pinnedAt: updated.pinnedAt });
      } catch (err) {
        console.error("[Socket pin_message error]", err);
      }
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
    void checkAutoCheckIn(userId);

    // Heartbeat: client sends ping every 30s
    socket.on("ping", async () => {
      void setPresence(userId, "online");
      void updateLastActive(userId);
      void checkAutoCheckIn(userId);
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

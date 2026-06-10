import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { setPresence, updateLastActive, setTyping, clearTyping } from "@/lib/db/redis";
import { prisma } from "@/lib/db/prisma";
import { checkAutoCheckIn } from "@/lib/attendance/attendance-helpers";
import { createNormalChatMessage } from "@/lib/chat/chat-send-message";
import { callAI } from "@/lib/ai/ai";
import { SHOW_AI_FEATURES } from "@/config/features";
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
    console.log(`[Socket] /chat connection: userId=${userId}`);

    // ⚠️ REGISTER ALL EVENT LISTENERS FIRST (synchronously)
    // BEFORE any await — otherwise buffered events like "join_room" arrive
    // before the handler exists and get silently dropped.

    // ---- JOIN ROOM ----
    socket.on("join_room", async (roomId: string) => {
      if (roomId.startsWith("project:") || roomId.startsWith("project_questions:") || roomId.startsWith("project_vault:") || roomId.startsWith("project_assets:")) {
        const pid = roomId.replace(/^project(_\w+)?:/, "");
        const project = await prisma.project.findUnique({
          where: { id: pid },
          select: {
            clientId: true,
            members: { where: { userId }, select: { id: true } },
            projectClients: { where: { clientId: userId }, select: { id: true } },
          },
        });
        const isMember = (project?.members.length ?? 0) > 0;
        const isClient = project?.clientId === userId || (project?.projectClients.length ?? 0) > 0;
        const isManager = ["ADMIN", "PROJECT_MANAGER"].includes(socket.data.role);
        if (!isMember && !isClient && !isManager) {
          return socket.emit("error", "Not authorized for this project");
        }
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
      if (roomId.startsWith("project:") || roomId.startsWith("project_questions:") || roomId.startsWith("project_vault:") || roomId.startsWith("project_assets:")) {
        console.log(`[Socket] LEAVE room: ${roomId} (user=${userId})`);
        socket.leave(roomId);
      }
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
        if (SHOW_AI_FEATURES && (content?.startsWith("/professionalize ") || content?.startsWith("/email "))) {
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
        if (SHOW_AI_FEATURES && content?.includes("@ai")) {
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
      const existing = await prisma.messageReaction.findUnique({
        where: { messageId_userId_emoji: { messageId, userId, emoji } },
      });
      if (existing) {
        await prisma.messageReaction.delete({ where: { id: existing.id } });
      } else {
        await prisma.messageReaction.deleteMany({ where: { messageId, userId } });
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

    // ---- NOW do async setup AFTER all listeners are registered ----
    // Join chat rooms the user is a member of
    await updateLastActive(userId);
    try {
      const chatMemberships = await prisma.chatRoomMember.findMany({
        where: { userId },
        select: { roomId: true },
      });
      for (const m of chatMemberships) socket.join(`room:${m.roomId}`);
    } catch (err) {
      console.error(`[Socket] Failed to load chat rooms for ${userId}:`, err);
    }

    // Auto-join user room for direct notifications
    socket.join(`user:${userId}`);

    // Auto-join all project rooms the user belongs to
    // Admins and project managers get ALL projects so they never miss updates
    try {
      const isManager = ["ADMIN", "PROJECT_MANAGER"].includes(socket.data.role as string);
      const userProjects = isManager
        ? await prisma.project.findMany({ select: { id: true } })
        : await prisma.project.findMany({
            where: {
              OR: [
                { members: { some: { userId } } },
                { projectClients: { some: { clientId: userId } } },
                { clientId: userId },
              ],
            },
            select: { id: true },
          });
      for (const p of userProjects) {
        socket.join(`project:${p.id}`);
      }
      if (userProjects.length > 0) {
        console.log(`[Socket] Auto-joined ${userProjects.length} project rooms for user=${userId} (manager=${isManager})`);
      }
    } catch (err) {
      console.error(`[Socket] Failed to auto-join project rooms for ${userId}:`, err);
    }

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

  // ============================================================
  // /projects NAMESPACE
  // ============================================================
  const projectsNS = io.of("/projects");
  projectsNS.use(authMiddleware);

  projectsNS.on("connection", async (socket) => {
    const userId = socket.data.userId as string;
    const role = socket.data.role as string;

    socket.join(`user:${userId}`);

    // Clients join their own project room
    // Managers/admins join all projects
    if (role === "CLIENT") {
      socket.join("client_projects");
    } else if (["ADMIN", "PROJECT_MANAGER"].includes(role)) {
      socket.join("manager_projects");
    }

    try {
      const isManager = ["ADMIN", "PROJECT_MANAGER"].includes(role);
      const projects = isManager
        ? await prisma.project.findMany({ select: { id: true } })
        : await prisma.project.findMany({
            where: {
              OR: [
                { members: { some: { userId } } },
                { projectClients: { some: { clientId: userId } } },
                { clientId: userId },
              ],
            },
            select: { id: true },
          });

      for (const project of projects) {
        socket.join(`project:${project.id}`);
      }
    } catch (err) {
      console.error(`[Socket] Failed to join /projects rooms for ${userId}:`, err);
    }
  });

  // Export helper for use in API routes via global.io
  return { chatNS, presenceNS, notifNS, projectsNS };
}

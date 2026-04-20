import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { createNormalChatMessage } from "@/lib/chat-send-message";
import { logAction } from "@/lib/audit";
import { getClientIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const PostMessageSchema = z
  .object({
    content: z.string().optional(),
    mediaUrl: z.string().min(1).optional(),
    mediaType: z.string().min(1).optional(),
    replyToId: z.string().optional(),
  })
  .refine(
    (d) =>
      (typeof d.content === "string" && d.content.trim().length > 0) ||
      (Boolean(d.mediaUrl) && Boolean(d.mediaType)),
    { message: "Message must include text or both mediaUrl and mediaType" }
  );

export const GET = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const roomId = ctx?.params.roomId;
    if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

    // Verify membership
    const member = await prisma.chatRoomMember.findFirst({
      where: { roomId, userId, room: { deletedAt: null } },
    });
    if (!member) forbidden();

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");

    const messages = await prisma.message.findMany({
      where: { roomId },
      include: {
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
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > PAGE_SIZE;
    const result = hasMore ? messages.slice(0, PAGE_SIZE) : messages;

    // Update lastReadAt
    await prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastReadAt: new Date() },
    });

    const role = req.headers.get("x-user-role") ?? "";

    // Strictly filter out SUPER_ADMIN messages for EVERYONE (hidden role)
    // Also filter out non-managers if the viewer is a CLIENT
    let finalMessages = result.filter(m => m.sender.role !== "SUPER_ADMIN");

    if (role === "CLIENT") {
      finalMessages = finalMessages.filter(m => 
        ["ADMIN", "PROJECT_MANAGER", "CLIENT"].includes(m.sender.role)
      );
    }

    return NextResponse.json({
      data: {
        messages: finalMessages.reverse(), // oldest first for display
        nextCursor: hasMore ? result[0].id : null,
      },
    });
  }
);

export const POST = apiHandler(
  async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    const userId = req.headers.get("x-user-id") ?? forbidden();
    const roomId = ctx?.params.roomId;
    if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

    const member = await prisma.chatRoomMember.findFirst({
      where: { roomId, userId, room: { deletedAt: null } },
      include: {
        room: {
          select: {
            type: true,
            adminsOnlyPosting: true,
          },
        },
      },
    });
    if (!member) {
      forbidden();
      throw new Error("Forbidden");
    }

    if (member.room.type === "custom_group" && member.room.adminsOnlyPosting) {
      const isGlobalManager = ["ADMIN", "PROJECT_MANAGER"].includes(req.headers.get("x-user-role") ?? "");
      if (!isGlobalManager && !member.isGroupAdmin) {
        return NextResponse.json(
          { error: "Only admins can post in this group" },
          { status: 403 }
        );
      }
    }

    const body = PostMessageSchema.parse(await req.json());
    const content = body.content?.trim() ?? "";

    const message = await createNormalChatMessage({
      roomId,
      senderId: userId,
      content: content.length > 0 ? content : null,
      mediaUrl: body.mediaUrl ?? null,
      mediaType: body.mediaType ?? null,
      replyToId: body.replyToId,
    });

    await logAction(
      userId,
      "CHAT_MESSAGE_CREATE",
      "Message",
      message.id,
      { roomId, hasMedia: Boolean(body.mediaUrl) },
      getClientIp(req)
    );

    return NextResponse.json({ data: { message } });
  }
);

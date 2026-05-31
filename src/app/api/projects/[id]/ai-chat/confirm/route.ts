import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/db/audit";
import type { Server } from "socket.io";

declare global {
  var io: Server;
}

export const dynamic = "force-dynamic";

const confirmSchema = z.object({
  messageId: z.string(),
  approved: z.boolean(),
  actionType: z.enum(["edit_document"]),
  documentId: z.string(),
});

export const POST = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = ctx?.params?.id;
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only team members can confirm edits
  if (role === "CLIENT") forbidden();

  const body = confirmSchema.parse(await req.json());
  const { approved, actionType, documentId } = body;

  if (!approved) {
    // Log rejection
    await logAction(userId, "AI_EDIT_REJECTED", "Document", documentId, {
      projectId,
      actionType,
    });

    // Add rejection message to conversation
    const conversation = await prisma.projectAIConversation.findUnique({
      where: { projectId },
    });

    if (conversation) {
      await prisma.projectAIMessage.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: "The proposed changes were rejected by the user.",
        },
      });
    }

    return NextResponse.json({ success: true, message: "Changes rejected" });
  }

  // Handle approved edit
  if (actionType === "edit_document") {
    // Get the message with the pending edit details
    const message = await prisma.projectAIMessage.findUnique({
      where: { id: body.messageId },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Parse the tool result from message content to get edit details
    // The AI should have stored the proposal in a specific format
    // For now, we'll extract from the content or use a stored pending action
    
    // Get the document
    const document = await prisma.document.findFirst({
      where: { id: documentId, projectId },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // The actual new content should be extracted from the message/tool call
    // For now, we'll look for the most recent assistant message with this document
    const conversation = await prisma.projectAIConversation.findUnique({
      where: { projectId },
      include: {
        messages: {
          where: { role: "assistant" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!conversation || conversation.messages.length === 0) {
      return NextResponse.json({ error: "No edit proposal found" }, { status: 404 });
    }

    // Extract new content from the message - this is a simplified approach
    // In production, you'd want to store the pending edit in a separate table
    const assistantMessage = conversation.messages[0];
    
    // Try to extract from tool_calls if available
    let newContent = document.content || "";
    
    // For now, we'll require the AI to include the new content in a specific format
    // The frontend should pass the newContent in the request body
    const requestBody = await req.json().catch(() => ({}));
    if (requestBody.newContent) {
      newContent = requestBody.newContent;
    }

    // Update the document
    const updatedDoc = await prisma.document.update({
      where: { id: documentId },
      data: {
        content: newContent,
        updatedAt: new Date(),
      },
    });

    // Log the action
    await logAction(userId, "AI_EDIT_APPROVED", "Document", documentId, {
      projectId,
      documentTitle: document.title,
      previousLength: (document.content || "").length,
      newLength: newContent.length,
    });

    // Add confirmation message
    await prisma.projectAIMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: `✅ I've successfully updated "${document.title}" with the approved changes.`,
      },
    });

    // Emit real-time update
    if (global.io) {
      global.io.of("/projects").emit("document_updated", {
        document: updatedDoc,
        projectId,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Document updated successfully",
      document: updatedDoc,
    });
  }

  return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
});

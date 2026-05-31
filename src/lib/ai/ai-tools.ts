import { prisma } from "@/lib/db/prisma";
import { updateContextDocument, readContextDocument } from "@/lib/ai/ai-context";

/**
 * Enhanced Tools available for the Project AI Assistant.
 * Includes: data fetching, full content retrieval, chat history with limits, and context management.
 */
export const PROJECT_AI_TOOLS = [
  {
    name: "get_project_data",
    description: "Returns core project details, milestones, and task counts.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_project_members",
    description: "Returns all project members with their roles and work modes.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_tasks",
    description: "Returns a list of tasks for the project. Use get_task_details for full descriptions.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        status: { type: "string", enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"] },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_task_details",
    description: "Returns full details of a specific task including description, assignees, and comments.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "get_documents",
    description: "Returns titles and types of project documents. Use get_document_content for full text.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_document_content",
    description: "Returns the full content of a specific document. Use for reading important documents.",
    parameters: {
      type: "object",
      properties: {
        documentId: { type: "string" },
        projectId: { type: "string" },
      },
      required: ["documentId", "projectId"],
    },
  },
  {
    name: "get_questions",
    description: "Returns all client questions and answers for the project.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_recent_chat",
    description: "Returns recent messages from project chat rooms. Limit max 50.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        limit: { type: "number", default: 20, description: "Number of messages to fetch (max 50)" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_chat_room_messages",
    description: "Returns messages from a specific chat room with optional limit.",
    parameters: {
      type: "object",
      properties: {
        roomId: { type: "string" },
        limit: { type: "number", default: 30, description: "Number of messages (max 100)" },
      },
      required: ["roomId"],
    },
  },
  {
    name: "update_ai_context",
    description: "IMPORTANT: Use this to save key information you learn about the project. Updates the AI context memory document with new facts, decisions, or important notes. Call this after learning something significant.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        newContent: { type: "string", description: "New context information to append. Include a timestamp and clear summary." },
      },
      required: ["projectId", "newContent"],
    },
  },
  {
    name: "read_ai_context",
    description: "Reads the AI context memory document. Use this at the start of conversations to see what you already know about the project.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_assets",
    description: "Returns all project assets (files) including media, documents, code files, etc. Shows file names, types, sizes, and visibility status.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "read_asset_content",
    description: "Reads the content of an asset file. Supports text files, code files, PDFs, and documents. Use when user asks about specific files in assets.",
    parameters: {
      type: "object",
      properties: {
        assetId: { type: "string" },
        projectId: { type: "string" },
      },
      required: ["assetId", "projectId"],
    },
  },
  {
    name: "propose_document_edit",
    description: "Proposes an edit to a project document. The user must confirm before changes are applied. Use this when the user asks you to modify, update, or edit a document.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        documentId: { type: "string" },
        title: { type: "string", description: "Document title for reference" },
        explanation: { type: "string", description: "Brief explanation of what changed and why" },
        currentContent: { type: "string", description: "The current full document content" },
        newContent: { type: "string", description: "The proposed new full document content" },
      },
      required: ["projectId", "documentId", "title", "explanation", "currentContent", "newContent"],
    },
  },
];

export async function executeTool(name: string, args: any) {
  switch (name) {
    case "get_project_data": {
      const p = await prisma.project.findUnique({
        where: { id: args.projectId },
        include: {
          milestones: { orderBy: { order: "asc" } },
          client: { select: { name: true, email: true } },
          _count: { select: { tasks: true, documents: true, members: true } },
        },
      });
      return p ? {
        title: p.title,
        status: p.status,
        client: p.client,
        milestones: p.milestones.map(m => `${m.title} (${m.status})`),
        stats: p._count
      } : { error: "Project not found" };
    }

    case "get_project_members": {
      const members = await prisma.projectMember.findMany({
        where: { projectId: args.projectId },
        include: {
          user: { select: { id: true, name: true, email: true, role: true, workMode: true } }
        }
      });
      return {
        members: members.map(m => ({
          name: m.user.name,
          email: m.user.email,
          role: m.user.role,
          workMode: m.user.workMode,
          joinedAt: m.joinedAt
        }))
      };
    }

    case "get_tasks": {
      const tasks = await prisma.task.findMany({
        where: { 
          projectId: args.projectId,
          ...(args.status ? { status: args.status } : {})
        },
        select: { id: true, title: true, status: true, completedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 50
      });
      return { tasks };
    }

    case "get_task_details": {
      const task = await prisma.task.findUnique({
        where: { id: args.taskId },
        include: {
          assignees: { include: { user: { select: { name: true, role: true } } } }
        }
      });
      if (!task) return { error: "Task not found" };
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        description: task.description,
        completedAt: task.completedAt,
        assignees: task.assignees.map((a: any) => a.user.name)
      };
    }

    case "get_documents": {
      const docs = await prisma.document.findMany({
        where: { 
          projectId: args.projectId,
          docType: { not: "internal" } // Exclude internal docs like AI context
        },
        select: { id: true, title: true, docType: true, access: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 30
      });
      return { documents: docs };
    }

    case "get_document_content": {
      const doc = await prisma.document.findFirst({
        where: { id: args.documentId, projectId: args.projectId },
        select: { id: true, title: true, content: true, docType: true }
      });
      if (!doc) return { error: "Document not found" };
      return {
        id: doc.id,
        title: doc.title,
        type: doc.docType,
        content: doc.content || "(empty document)"
      };
    }

    case "get_questions": {
      const questions = await prisma.projectQuestion.findMany({
        where: { projectId: args.projectId },
        include: { 
          answers: { select: { content: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } 
        },
        orderBy: { createdAt: "desc" }
      });
      return { 
        questions: questions.map(q => ({
          text: q.text,
          isApproved: q.isApproved,
          lastAnswer: q.answers[0]?.content
        })) 
      };
    }

    case "get_recent_chat": {
      const limit = Math.min(args.limit || 20, 50);
      const rooms = await prisma.chatRoom.findMany({
        where: { projectId: args.projectId },
        select: { id: true, name: true, type: true }
      });
      const messages = await prisma.message.findMany({
        where: { roomId: { in: rooms.map(r => r.id) } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { 
          sender: { select: { name: true, role: true } },
          room: { select: { name: true } }
        }
      });
      return { 
        messages: messages.reverse().map(m => ({
          sender: m.sender.name,
          senderRole: m.sender.role,
          room: m.room.name,
          content: m.content,
          time: m.createdAt
        })) 
      };
    }

    case "get_chat_room_messages": {
      const limit = Math.min(args.limit || 30, 100);
      const messages = await prisma.message.findMany({
        where: { roomId: args.roomId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { sender: { select: { name: true, role: true } } }
      });
      return {
        messages: messages.reverse().map(m => ({
          sender: m.sender.name,
          senderRole: m.sender.role,
          content: m.content,
          time: m.createdAt
        }))
      };
    }

    case "update_ai_context": {
      try {
        await updateContextDocument(args.projectId, args.newContent);
        return { success: true, message: "Context updated successfully" };
      } catch (error) {
        return { error: "Failed to update context", details: String(error) };
      }
    }

    case "read_ai_context": {
      try {
        const content = await readContextDocument(args.projectId);
        return { content };
      } catch (error) {
        return { error: "Failed to read context", details: String(error) };
      }
    }

    case "get_assets": {
      const assets = await prisma.asset.findMany({
        where: { projectId: args.projectId },
        include: { uploadedBy: { select: { name: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return {
        assets: assets.map(a => ({
          id: a.id,
          name: a.name,
          fileType: a.fileType,
          fileSize: a.fileSize,
          uploadedBy: a.uploadedBy.name,
          uploaderRole: a.uploadedBy.role,
          isVisibleToClient: a.isVisibleToClient,
          createdAt: a.createdAt,
        }))
      };
    }

    case "read_asset_content": {
      const asset = await prisma.asset.findFirst({
        where: { id: args.assetId, projectId: args.projectId },
      });
      if (!asset) return { error: "Asset not found" };

      // Try to fetch and read the file
      try {
        const response = await fetch(asset.fileUrl);
        if (!response.ok) {
          return { error: "Failed to fetch file", url: asset.fileUrl };
        }

        // For text-based files, return content directly
        const isText = asset.fileType.startsWith("text/") ||
          asset.fileType.includes("json") ||
          asset.fileType.includes("javascript") ||
          asset.fileType.includes("typescript") ||
          asset.fileType.includes("html") ||
          asset.fileType.includes("css") ||
          asset.fileType.includes("xml") ||
          asset.fileType.includes("csv");

        if (isText) {
          const content = await response.text();
          return {
            id: asset.id,
            name: asset.name,
            type: asset.fileType,
            content: content.slice(0, 10000), // Limit to 10k chars
            truncated: content.length > 10000,
          };
        }

        // For PDFs, we can't easily extract text client-side in tools
        // Return metadata with instructions to ask user about PDF content
        if (asset.fileType.includes("pdf")) {
          return {
            id: asset.id,
            name: asset.name,
            type: "application/pdf",
            content: "[PDF file - unable to extract text directly]",
            url: asset.fileUrl,
            note: "This is a PDF file. Ask the user to provide specific questions about its content, or summarize what they need from it.",
          };
        }

        // For images/media, describe what it is
        if (asset.fileType.startsWith("image/")) {
          return {
            id: asset.id,
            name: asset.name,
            type: asset.fileType,
            content: "[Image file]",
            url: asset.fileUrl,
            note: "This is an image file. I can see it's uploaded to the project assets.",
          };
        }

        // Binary/other files
        return {
          id: asset.id,
          name: asset.name,
          type: asset.fileType,
          content: "[Binary file]",
          note: "This file type cannot be directly read. It's stored in project assets.",
        };
      } catch (error) {
        return { error: "Failed to read asset", details: String(error) };
      }
    }

    case "propose_document_edit": {
      // This tool doesn't actually edit - it returns the proposal for confirmation
      // The actual edit happens via the confirmation API
      return {
        requiresConfirmation: true,
        actionType: "edit_document",
        documentId: args.documentId,
        title: args.title,
        explanation: args.explanation,
        currentContent: args.currentContent,
        newContent: args.newContent,
        message: `I've prepared edits to "${args.title}". The user needs to confirm before I apply these changes.`,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

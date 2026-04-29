import { prisma } from "./prisma";
import { updateContextDocument, readContextDocument } from "./ai-context";

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

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

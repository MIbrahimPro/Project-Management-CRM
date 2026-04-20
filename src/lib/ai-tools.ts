import { prisma } from "./prisma";

/**
 * Tools available for the Project AI Assistant.
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
    name: "get_tasks",
    description: "Returns a list of tasks for the project.",
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
    name: "get_documents",
    description: "Returns titles and brief descriptions of project documents.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
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
    description: "Returns the last 20 messages from project chat rooms.",
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
          _count: { select: { tasks: true, documents: true, members: true } },
        },
      });
      return p ? {
        title: p.title,
        status: p.status,
        milestones: p.milestones.map(m => `${m.title} (${m.status})`),
        stats: p._count
      } : { error: "Project not found" };
    }

    case "get_tasks": {
      const tasks = await prisma.task.findMany({
        where: { 
          projectId: args.projectId,
          ...(args.status ? { status: args.status } : {})
        },
        select: { title: true, status: true, createdAt: true },
        take: 50
      });
      return { tasks };
    }

    case "get_documents": {
      const docs = await prisma.document.findMany({
        where: { projectId: args.projectId },
        select: { title: true, docType: true, access: true },
        take: 30
      });
      return { documents: docs };
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
      const rooms = await prisma.chatRoom.findMany({
        where: { projectId: args.projectId },
        select: { id: true }
      });
      const messages = await prisma.message.findMany({
        where: { roomId: { in: rooms.map(r => r.id) } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { sender: { select: { name: true } } }
      });
      return { 
        messages: messages.reverse().map(m => ({
          sender: m.sender.name,
          content: m.content,
          time: m.createdAt
        })) 
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

import { prisma } from "./prisma";

const CONTEXT_DOC_TITLE = "__AI_CONTEXT__";
const DEFAULT_CHAT_HISTORY_LIMIT = 30;

/**
 * Role-based knowledge access levels
 */
export const ROLE_KNOWLEDGE_LEVELS: Record<string, number> = {
  SUPER_ADMIN: 10,    // Everything
  ADMIN: 9,           // Almost everything
  PROJECT_MANAGER: 8, // Project details, limited HR
  DEVELOPER: 7,       // Technical details, tasks
  DESIGNER: 6,        // Design assets, tasks
  HR: 7,              // HR data, limited project
  ACCOUNTANT: 5,      // Financial data
  SALES: 6,           // Client data, proposals
  CLIENT: 3,          // Own project only
};

/**
 * Get or create the AI context document for a project
 */
export async function getOrCreateContextDocument(projectId: string) {
  let doc = await prisma.document.findFirst({
    where: { projectId, title: CONTEXT_DOC_TITLE, docType: "internal" },
  });

  if (!doc) {
    doc = await prisma.document.create({
      data: {
        projectId,
        title: CONTEXT_DOC_TITLE,
        docType: "internal",
        access: "INTERNAL",
        createdById: "system",
        content: "# AI Context Memory\n\nThis document is maintained by the AI assistant to store important context about the project.",
      },
    });
  }

  return doc;
}

/**
 * Update AI context document content
 */
export async function updateContextDocument(projectId: string, newContent: string) {
  const doc = await getOrCreateContextDocument(projectId);
  
  await prisma.document.update({
    where: { id: doc.id },
    data: {
      content: newContent,
      updatedAt: new Date(),
    },
  });

  return doc;
}

/**
 * Read AI context document content
 */
export async function readContextDocument(projectId: string): Promise<string> {
  const doc = await prisma.document.findFirst({
    where: { projectId, title: CONTEXT_DOC_TITLE, docType: "internal" },
  });

  return doc?.content || "";
}

/**
 * Gather comprehensive project context for AI
 */
export async function gatherFullProjectContext(
  projectId: string,
  userId: string,
  options?: {
    includeChatHistory?: boolean;
    chatLimit?: number;
    includeMembers?: boolean;
    includeFullTasks?: boolean;
    includeFullDocuments?: boolean;
    documentIds?: string[];
    taskIds?: string[];
  }
): Promise<{
  project: any;
  members: any[];
  milestones: any[];
  tasks: any[];
  documents: any[];
  chatHistory: any[];
  aiContext: string;
  currentUser: any;
}> {
  // 1. Get project with milestones
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      milestones: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, status: true, content: true, completedAt: true },
      },
      client: { select: { id: true, name: true, email: true } },
    },
  });

  if (!project) throw new Error("Project not found");

  // 2. Get current user details
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, workMode: true, statedRole: true },
  });

  // 3. Get project members with role info
  const members = options?.includeMembers !== false 
    ? await prisma.projectMember.findMany({
        where: { projectId },
        include: {
          user: { select: { id: true, name: true, email: true, role: true, workMode: true } },
        },
      })
    : [];

  // 4. Get tasks (summary or full)
  const taskSelect = options?.includeFullTasks
    ? { 
        id: true, title: true, status: true,
        description: true, completedAt: true, createdAt: true,
        assignees: { include: { user: { select: { name: true } } } }
      }
    : { id: true, title: true, status: true };

  const tasks = await prisma.task.findMany({
    where: { 
      projectId,
      ...(options?.taskIds?.length ? { id: { in: options.taskIds } } : {})
    },
    select: taskSelect as any,
    orderBy: { updatedAt: "desc" },
    take: options?.includeFullTasks ? 50 : 100,
  });

  // 5. Get documents (summary or full content)
  const docs = await prisma.document.findMany({
    where: { 
      projectId,
      docType: { not: "internal" }, // Exclude internal docs like context
      ...(options?.documentIds?.length ? { id: { in: options.documentIds } } : {})
    },
    select: { 
      id: true, title: true, docType: true, access: true, updatedAt: true,
      ...(options?.includeFullDocuments ? { blocksJson: true } : {})
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  // Extract content from full documents if requested
  const documents = docs.map(d => {
    if (options?.includeFullDocuments && d.blocksJson) {
      try {
        const blocks = JSON.parse(d.blocksJson);
        let content = "";
        for (const block of blocks) {
          if (block.content) {
            for (const item of block.content) {
              if (item.text) content += item.text + " ";
            }
          }
        }
        return { ...d, extractedContent: content.slice(0, 8000) };
      } catch {
        return d;
      }
    }
    return d;
  });

  // 6. Get chat history
  const chatHistory = options?.includeChatHistory !== false
    ? await getProjectChatHistory(projectId, options?.chatLimit || DEFAULT_CHAT_HISTORY_LIMIT)
    : [];

  // 7. Get AI context file
  const aiContext = await readContextDocument(projectId);

  return {
    project,
    members,
    milestones: project.milestones,
    tasks,
    documents,
    chatHistory,
    aiContext,
    currentUser,
  };
}

/**
 * Get chat history from all project rooms
 */
async function getProjectChatHistory(projectId: string, limit: number) {
  const rooms = await prisma.chatRoom.findMany({
    where: { projectId },
    select: { id: true, name: true, type: true },
  });

  const messages = await prisma.message.findMany({
    where: { roomId: { in: rooms.map(r => r.id) } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { 
      sender: { select: { id: true, name: true, role: true } },
      room: { select: { name: true, type: true } }
    },
  });

  return messages.reverse().map(m => ({
    id: m.id,
    sender: m.sender.name,
    senderRole: m.sender.role,
    room: m.room.name,
    roomType: m.room.type,
    content: m.content,
    time: m.createdAt,
  }));
}

/**
 * Format context for AI prompt with role-based filtering
 */
export function formatContextForAI(
  context: Awaited<ReturnType<typeof gatherFullProjectContext>>,
  userKnowledgeLevel: number
): string {
  const parts: string[] = [];

  // Header with current user info
  parts.push(`=== CURRENT USER ===`);
  parts.push(`Name: ${context.currentUser?.name || "Unknown"}`);
  parts.push(`Role: ${context.currentUser?.role || "Unknown"}`);
  parts.push(`Work Mode: ${context.currentUser?.workMode || "Unknown"}`);
  parts.push(`Knowledge Level: ${userKnowledgeLevel}/10`);
  parts.push("");

  // Project info
  parts.push(`=== PROJECT: ${context.project.title} ===`);
  parts.push(`Status: ${context.project.status}`);
  parts.push(`ID: ${context.project.id}`);
  if (context.project.client) {
    parts.push(`Client: ${context.project.client.name} (${context.project.client.email})`);
  }
  parts.push("");

  // Milestones
  if (context.milestones.length > 0) {
    parts.push(`=== MILESTONES (${context.milestones.length}) ===`);
    context.milestones.forEach(m => {
      parts.push(`- ${m.title} [${m.status}]${m.completedAt ? ` (Completed: ${m.completedAt.toISOString().split("T")[0]})` : ""}`);
      if (m.content && userKnowledgeLevel >= 5) {
        parts.push(`  ${m.content.slice(0, 100)}${m.content.length > 100 ? "..." : ""}`);
      }
    });
    parts.push("");
  }

  // Members (filtered by knowledge level)
  if (context.members.length > 0 && userKnowledgeLevel >= 4) {
    parts.push(`=== TEAM MEMBERS (${context.members.length}) ===`);
    context.members.forEach(m => {
      const roleLevel = ROLE_KNOWLEDGE_LEVELS[m.user.role] || 5;
      // Only show members at or below user's knowledge level
      if (roleLevel <= userKnowledgeLevel + 2) {
        parts.push(`- ${m.user.name} (${m.user.role})${m.user.workMode ? ` [${m.user.workMode}]` : ""}`);
      } else {
        parts.push(`- ${m.user.name} (Team Member)`);
      }
    });
    parts.push("");
  }

  // Tasks
  if (context.tasks.length > 0) {
    parts.push(`=== TASKS (${context.tasks.length} shown) ===`);
    context.tasks.slice(0, 20).forEach((t: any) => {
      parts.push(`- ${t.title} [${t.status}]${t.priority ? ` (P:${t.priority})` : ""}`);
      if (t.assignees?.length > 0) {
        parts.push(`  Assigned: ${t.assignees.map((a: any) => a.user.name).join(", ")}`);
      }
    });
    parts.push("");
  }

  // Documents (titles only unless high knowledge)
  if (context.documents.length > 0) {
    parts.push(`=== DOCUMENTS (${context.documents.length} shown) ===`);
    context.documents.slice(0, 15).forEach((d: any) => {
      parts.push(`- ${d.title} (${d.docType})`);
      if (d.extractedContent && userKnowledgeLevel >= 6) {
        parts.push(`  Preview: ${d.extractedContent.slice(0, 150)}...`);
      }
    });
    parts.push("");
  }

  // Chat history (last N messages)
  if (context.chatHistory.length > 0) {
    parts.push(`=== RECENT CHAT (${context.chatHistory.length} messages) ===`);
    context.chatHistory.forEach(m => {
      const shortTime = new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      parts.push(`[${shortTime}] ${m.sender} in ${m.room}: ${m.content.slice(0, 100)}${m.content.length > 100 ? "..." : ""}`);
    });
    parts.push("");
  }

  // AI's previous context/notes
  if (context.aiContext) {
    parts.push(`=== AI CONTEXT MEMORY ===`);
    parts.push(context.aiContext.slice(0, 2000));
    parts.push("");
  }

  return parts.join("\n");
}

/**
 * Build chain-of-thought prompt
 */
export function buildChainOfThoughtPrompt(basePrompt: string, context: string): string {
  return `${basePrompt}

You have access to tools to fetch additional information. When you need more context, call the appropriate tool.
After gathering information, provide your response and update the AI Context Memory with any important new facts.

${context}

When responding:
1. First, identify what you know and what you need to know
2. If you need more data, call tools to fetch it
3. Provide a clear, helpful response
4. If you learned something important that should be remembered, update the context file`;
}

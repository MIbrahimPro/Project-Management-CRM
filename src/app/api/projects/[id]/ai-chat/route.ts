import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { callAIRaw, type Message } from "@/lib/ai/ai";
import { PROJECT_AI_TOOLS, executeTool } from "@/lib/ai/ai-tools";
import { gatherFullProjectContext, formatContextForAI, ROLE_KNOWLEDGE_LEVELS } from "@/lib/ai/ai-context";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  content: z.string().min(1).max(10000),
  sourceContext: z.object({
    documentId: z.string().optional(),
    taskId: z.string().optional(),
    roomId: z.string().optional(),
  }).optional(),
});

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = ctx?.params?.id;
  if (!projectId) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const conversation = await prisma.projectAIConversation.findUnique({
    where: { projectId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json({ data: conversation?.messages ?? [] });
});

export const POST = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = ctx?.params?.id;
  if (!projectId) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const body = bodySchema.parse(await req.json());

  // 1. Ensure conversation exists
  let conversation = await prisma.projectAIConversation.findUnique({
    where: { projectId },
  });

  if (!conversation) {
    conversation = await prisma.projectAIConversation.create({
      data: { projectId },
    });
  }

  // 2. Save user message
  await prisma.projectAIMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: body.content,
      userId,
    },
  });

  // 3. Load full history for AI
  const history = await prisma.projectAIMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });

  const aiMessages: Message[] = history.map(m => ({
    role: m.role as any,
    content: m.content,
  }));

  // Fetch comprehensive context
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, workMode: true, statedRole: true },
  });

  const knowledgeLevel = ROLE_KNOWLEDGE_LEVELS[user?.role || "DEVELOPER"] || 5;

  // Gather full project context
  const fullContext = await gatherFullProjectContext(projectId, userId, {
    includeChatHistory: true,
    chatLimit: 30,
    includeMembers: true,
    includeFullTasks: false,
    includeFullDocuments: false,
  });

  // If source context provided, fetch those details
  if (body.sourceContext?.documentId) {
    const doc = await prisma.document.findFirst({
      where: { id: body.sourceContext.documentId, projectId },
      select: { id: true, title: true, content: true },
    });
    if (doc) {
      fullContext.documents.unshift({ ...doc, extractedContent: doc.content || "" } as any);
    }
  }

  if (body.sourceContext?.taskId) {
    const task = await prisma.task.findFirst({
      where: { id: body.sourceContext.taskId, projectId },
      include: { assignees: { include: { user: { select: { name: true } } } } },
    });
    if (task) {
      fullContext.tasks.unshift(task as any);
    }
  }

  // Format context for AI
  const contextString = formatContextForAI(fullContext, knowledgeLevel);

  // Build enhanced system prompt with chain of thought instructions
  const systemPrompt = `You are DevRolin AI, an intelligent project assistant with TOOL ACCESS, MEMORY, and DOCUMENT EDITING capabilities.

=== YOUR IDENTITY ===
You are assisting: ${user?.name || "Unknown"} (${user?.role || "Unknown"})
Their knowledge level: ${knowledgeLevel}/10

=== PROJECT CONTEXT ===
${contextString}

=== YOUR CAPABILITIES ===
You have access to these tools:
- get_project_data: Core project info, milestones
- get_project_members: Team roster with roles
- get_tasks / get_task_details: Task lists and full task details
- get_documents / get_document_content: Document list and full content
- propose_document_edit: Propose changes to ANY document (requires user confirmation)
- get_assets: List all project files (images, code, documents, PDFs, etc.)
- read_asset_content: Read text/code file contents from assets
- get_questions: Client Q&A
- get_recent_chat / get_chat_room_messages: Chat history with configurable limits
- read_ai_context: Read your memory file (ALWAYS DO THIS FIRST)
- update_ai_context: Save key learnings to memory

=== CRITICAL PROTOCOL - YOU MUST FOLLOW ===
1. **ALWAYS START WITH MEMORY**: Call read_ai_context FIRST in every conversation. This tells you what you already know about the project.
2. **ANALYZE**: What does the user need? What do you know from context + memory?
3. **FETCH**: If you need more data (documents, tasks, chat), CALL THE TOOL.
4. **REASON**: Process the information. Consider role-based knowledge limits.
5. **RESPOND**: Provide helpful, accurate response.
6. **UPDATE MEMORY**: If you learned something important, CALL update_ai_context to save it.

=== DOCUMENT EDITING ===
When user asks to edit/update/modify a document:
1. Read the document content first using get_document_content
2. Prepare the new content with your changes
3. Call propose_document_edit with:
   - documentId, title, explanation of changes
   - currentContent (original), newContent (your version)
4. Wait for user confirmation before applying

=== MEMORY MANAGEMENT (MANDATORY) ===
- **MUST CALL read_ai_context at start of EVERY conversation** - Never skip this
- Call update_ai_context when you learn: decisions, facts, patterns, client preferences, technical choices
- Format: "[YYYY-MM-DD] Learned: [fact/decision]"
- Update frequently - better to save too much than forget important context

=== ROLE-BASED LIMITS ===
Your user's role (${user?.role}) has knowledge level ${knowledgeLevel}/10:
${knowledgeLevel >= 8 ? "- Full project access including sensitive details" : ""}
${knowledgeLevel >= 6 ? "- Can see most technical and business details" : "- Limited to general project information"}
${knowledgeLevel >= 4 ? "- Can see team member names and roles" : "- Cannot see detailed team information"}

Be proactive with tools. Never say "I don't have access" — you have tools to fetch everything.`;

  // 4. Tool calling loop (max 5 iterations)
  let currentMessages = [...aiMessages];
  let finalResponse = "";
  const pendingConfirmations: any[] = [];

  for (let i = 0; i < 5; i++) {
    const aiRes = await callAIRaw(currentMessages, {
      systemPrompt,
      tools: PROJECT_AI_TOOLS,
      taskType: "long_chat",
      temperature: 0.2,
    });

    if (!aiRes) {
      finalResponse = "AI is having trouble responding right now.";
      break;
    }

    currentMessages.push(aiRes);

    if (aiRes.tool_calls && aiRes.tool_calls.length > 0) {
      for (const toolCall of aiRes.tool_calls) {
        const result = await executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));
        
        // Check if this tool requires confirmation
        if (result.requiresConfirmation) {
          pendingConfirmations.push({
            messageId: Math.random().toString(36).substring(2, 15),
            ...result,
          });
        }
        
        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify(result),
        });
      }
      continue; // loop again with tool results
    } else {
      finalResponse = aiRes.content || "";
      break;
    }
  }

  // 5. Save AI response
  if (finalResponse) {
    await prisma.projectAIMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: finalResponse,
      },
    });
  }

  // Return response with any pending confirmations
  const response: any = { data: { content: finalResponse } };
  if (pendingConfirmations.length > 0) {
    response.pendingConfirmations = pendingConfirmations.map(p => ({
      messageId: p.messageId,
      type: p.actionType,
      documentId: p.documentId,
      title: p.title,
      explanation: p.explanation,
      proposedChanges: p.newContent.slice(0, 500) + (p.newContent.length > 500 ? "..." : ""),
    }));
  }

  return NextResponse.json(response);
});

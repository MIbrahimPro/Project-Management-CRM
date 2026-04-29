import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { callAIRaw, type Message } from "@/lib/ai";
import { PROJECT_AI_TOOLS, executeTool } from "@/lib/ai-tools";
import { gatherFullProjectContext, formatContextForAI, ROLE_KNOWLEDGE_LEVELS } from "@/lib/ai-context";

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
  const systemPrompt = `You are DevRolin AI, an intelligent project assistant with TOOL ACCESS and MEMORY.

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
- get_questions: Client Q&A
- get_recent_chat / get_chat_room_messages: Chat history with configurable limits
- read_ai_context: Read your memory file
- update_ai_context: IMPORTANT - Save key learnings to memory

=== CHAIN OF THOUGHT PROTOCOL ===
1. ANALYZE: What does the user need? What do you already know from context?
2. FETCH: If you need more data (full document, more chat history, specific task), CALL THE TOOL.
3. REASON: Process the information. Consider role-based knowledge limits.
4. RESPOND: Provide helpful, accurate response.
5. REMEMBER: If you learned something important (decisions, facts, context), CALL update_ai_context to save it.

=== MEMORY MANAGEMENT ===
- At conversation start: Call read_ai_context to see what you know
- During conversation: Call update_ai_context to save key facts
- Format: "[YYYY-MM-DD] Learned: [fact/decision]"

=== ROLE-BASED LIMITS ===
Your user's role (${user?.role}) has knowledge level ${knowledgeLevel}/10:
${knowledgeLevel >= 8 ? "- Full project access including sensitive details" : ""}
${knowledgeLevel >= 6 ? "- Can see most technical and business details" : "- Limited to general project information"}
${knowledgeLevel >= 4 ? "- Can see team member names and roles" : "- Cannot see detailed team information"}

Be proactive with tools. Never say "I don't have access" — you have tools to fetch everything.`;

  // 4. Tool calling loop (max 5 iterations)
  let currentMessages = [...aiMessages];
  let finalResponse = "";

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

  return NextResponse.json({ data: { content: finalResponse } });
});

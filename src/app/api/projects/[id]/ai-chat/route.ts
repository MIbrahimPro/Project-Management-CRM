import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { callAIRaw, type Message } from "@/lib/ai";
import { PROJECT_AI_TOOLS, executeTool } from "@/lib/ai-tools";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  content: z.string().min(1).max(10000),
});

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversation = await prisma.projectAIConversation.findUnique({
    where: { projectId: params.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json({ data: conversation?.messages ?? [] });
});

export const POST = apiHandler(async (req: NextRequest, { params }) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = bodySchema.parse(await req.json());
  const projectId = params.id;

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

  const systemPrompt = `You are the DevRolin Project Assistant. 
You have access to tools to read project data, milestones, tasks, chat, and documents.
Be concise but helpful. Always check the project state using tools if you are unsure.
Shared conversation for the whole team.`;

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

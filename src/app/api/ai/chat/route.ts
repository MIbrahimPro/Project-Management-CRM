import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { callAI } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CLIENT_ROLES = ["CLIENT"];

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(20000),
    }),
  ).min(1),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  workspaceId: z.string().optional(),
  newChat: z.boolean().optional(),
});

/**
 * Gather project context for AI: title, milestones, recent chat, doc titles, task names.
 * Caps output to ~3000 chars to leave room for user messages.
 */
async function gatherContext(opts: { projectId?: string; taskId?: string; workspaceId?: string }): Promise<string> {
  const parts: string[] = [];

  if (opts.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: opts.projectId },
      select: {
        title: true,
        status: true,
        milestones: { select: { title: true, status: true }, orderBy: { order: "asc" } },
        documents: { select: { title: true, docType: true }, take: 20 },
        tasks: { select: { title: true, status: true }, take: 20 },
      },
    });
    if (project) {
      parts.push(`Project: ${project.title} (${project.status})`);
      if (project.milestones.length) {
        parts.push("Milestones: " + project.milestones.map((m) => `${m.title} [${m.status}]`).join(", "));
      }
      if (project.documents.length) {
        parts.push("Documents: " + project.documents.map((d) => d.title).join(", "));
      }
      if (project.tasks.length) {
        parts.push("Tasks: " + project.tasks.map((t) => `${t.title} [${t.status}]`).join(", "));
      }
    }
  }

  if (opts.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: opts.taskId },
      select: { title: true, status: true, description: true },
    });
    if (task) {
      parts.push(`Task: ${task.title} (${task.status})`);
      if (task.description) {
        const desc = task.description.slice(0, 500);
        parts.push(`Description: ${desc}`);
      }
    }
  }

  if (opts.workspaceId) {
    const ws = await prisma.workspace.findUnique({
      where: { id: opts.workspaceId },
      select: { name: true, type: true, description: true },
    });
    if (ws) {
      parts.push(`Social media board: ${ws.name} (${ws.type})`);
      if (ws.description) parts.push(`Description: ${ws.description.slice(0, 500)}`);
    }
  }

  return parts.join("\n").slice(0, 3000);
}

/**
 * POST /api/ai/chat — AI assistant with optional persistent context.
 * If projectId/taskId/workspaceId is provided, conversation is saved per-user.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (CLIENT_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const body = bodySchema.parse(await req.json());
  const hasContext = !!(body.projectId || body.taskId || body.workspaceId);

  // Build context string
  let contextStr = "";
  if (hasContext) {
    contextStr = await gatherContext({
      projectId: body.projectId,
      taskId: body.taskId,
      workspaceId: body.workspaceId,
    });
  }

  const systemPrompt =
    "You are DevRolin Assistant, an AI helper embedded in a CRM for a software agency. " +
    "You help with project planning, writing, code review, HR questions, and general productivity tasks. " +
    "Respond directly without preamble. Decide response length based on question complexity. " +
    "Prioritize factual accuracy, explicit assumptions, and concrete steps. " +
    "If the user asks for JSON, return strict valid JSON and follow the requested schema exactly. " +
    "Use markdown formatting when helpful. Support code blocks with syntax highlighting." +
    (contextStr ? `\n\n--- Context ---\n${contextStr}` : "");

  // Load existing conversation if context-bound
  let conversationMessages = body.messages;
  let conversationId: string | undefined;

  if (hasContext && !body.newChat) {
    const existing = await prisma.aIConversation.findFirst({
      where: {
        userId,
        projectId: body.projectId ?? null,
        taskId: body.taskId ?? null,
        workspaceId: body.workspaceId ?? null,
      },
    });

    if (existing) {
      conversationId = existing.id;
      const saved = existing.messages as Array<{ role: string; content: string }>;
      // Merge: use saved history + new user message (last in body.messages)
      const lastUserMsg = body.messages[body.messages.length - 1];
      conversationMessages = [
        ...saved.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        lastUserMsg,
      ];
    }
  }

  const response = await callAI(conversationMessages, {
    systemPrompt,
    temperature: 0.4,
    taskType: "long_chat",
  });

  // Persist conversation if context-bound
  if (hasContext) {
    const updatedMessages = [
      ...conversationMessages,
      { role: "assistant" as const, content: response },
    ];

    if (conversationId) {
      await prisma.aIConversation.update({
        where: { id: conversationId },
        data: { messages: updatedMessages },
      });
    } else {
      await prisma.aIConversation.create({
        data: {
          userId,
          projectId: body.projectId ?? null,
          taskId: body.taskId ?? null,
          workspaceId: body.workspaceId ?? null,
          messages: updatedMessages,
        },
      });
    }
  }

  return NextResponse.json({ data: { content: response } });
});

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { callAI } from "@/lib/ai";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  context: z.string().max(10000).optional(),
  type: z.enum(["draft", "improve", "summarize", "expand"]).default("draft"),
});

// POST /api/ai/document — AI-assisted document writing
export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const body = bodySchema.parse(await req.json());

  const systemPrompts: Record<string, string> = {
    draft: "You are a professional document writer for a software agency. Write clear, structured content based on the prompt. Use markdown formatting.",
    improve: "You are an editor. Improve the given document content for clarity, grammar, and professionalism. Return the improved version only.",
    summarize: "Summarize the given document content concisely. Capture the key points in bullet format.",
    expand: "Expand the given content with more detail, examples, and explanation. Keep the same tone and style.",
  };

  const messages = body.context
    ? [
        { role: "user" as const, content: `Document context:\n${body.context}\n\nRequest: ${body.prompt}` },
      ]
    : [{ role: "user" as const, content: body.prompt }];

  const response = await callAI(messages, {
    systemPrompt: systemPrompts[body.type],
    maxTokens: 3000,
    temperature: 0.6,
    taskType: "document",
  });

  return NextResponse.json({ data: { content: response } });
});

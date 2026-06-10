import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/api-handler";
import { callAI } from "@/lib/ai/ai";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prompt: z.string().min(1).max(32000), // 32K chars for full document support
  context: z.string().max(64000).optional(),
  type: z.enum(["draft", "improve", "summarize", "expand", "format"]).default("draft"),
});

// POST /api/ai/document — AI-assisted document writing
export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const body = bodySchema.parse(await req.json());

  const systemPrompts: Record<string, string> = {
    draft: `You are a professional document writer. Write clear, structured content using markdown:
- ## for sections, ### for subsections
- **double asterisks** for bold, *single asterisks* for italic
- \`single backtick\` for inline code, \`\`\` for code blocks
- > for quotes, --- for dividers, - for lists, 1. for steps
Output only the formatted content.`,

    improve: `You are an editor. Improve the given content while preserving its structure.
Use markdown formatting:
- ## headings, **double asterisks** for bold, *single asterisks* for italic
- \`backticks\` for code, > for quotes, - for lists
Return only the improved version.`,

    summarize: `Summarize the given content concisely.
Use proper formatting:
- **bold** for key terms
- \`inline code\` for technical terms
- - bullet points for key takeaways
Keep it brief and structured.`,

    expand: `Expand the given content with more detail and examples.
Use full formatting:
- ## headings, **bold**, *italic*, \`code\`
- > quotes, - lists, 1. numbered steps, | tables |
Maintain and enhance document structure.`,

    format: `You are a document formatter. Transform the given input text into well-structured content.
Rules:
- Use ## for major sections, ### for subsections
- **double asterisks** for bold, *single asterisks* for italic
- \`single backtick\` for inline code
- \`\`\` for multi-line code blocks (specify language)
- > for blockquotes
- --- for section dividers
- - for bullet lists (flat, do NOT nest lists inside lists)
- 1. for numbered steps
- NEVER create nested/recursive lists
- Output ONLY the formatted content, no explanations.`,
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

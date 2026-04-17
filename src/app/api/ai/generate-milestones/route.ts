import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { callAIJson } from "@/lib/ai";

export const dynamic = "force-dynamic";

const Schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  existingMilestones: z.array(z.object({ title: z.string(), content: z.string().optional() })).optional(),
});

interface AIMilestone {
  title: string;
  content: string;
}

export const POST = apiHandler(async (req: NextRequest) => {
  const role = req.headers.get("x-user-role") ?? "";
  if (!["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

  const body = (await req.json()) as unknown;
  const { title, description, existingMilestones } = Schema.parse(body);
  const existingText = existingMilestones?.length 
    ? `\n\nExisting Draft Milestones (please improve and expand these):\n${existingMilestones.map((m, i) => `[${i+1}] ${m.title}${m.content ? `\n${m.content}` : ""}`).join("\n\n")}`
    : "";

  const milestones = await callAIJson<AIMilestone[]>(
    [
      {
        role: "user",
        content: `Generate ${existingText ? "an improved" : "a"} milestone plan for the following software project.${existingText}

Project: ${title}
Description: ${description}

Requirements:
- Usually return 3 to 4 milestones, but return as many as needed for project complexity (5-10+ is allowed when justified).
- Milestones must be ordered from discovery to launch.
- Each "content" must be detailed enough to act as milestone requirements (1-2 pages is acceptable for complex milestones).
- Write "content" in markdown-style structure so it can be converted to rich editor blocks:
  - Use headings (## or ###)
  - Use bullet points and numbered lists where useful
  - Use multiple paragraphs (not one large paragraph)
- Include scope, deliverables, acceptance criteria, and dependencies where relevant.
- Avoid vague statements like "work on feature".

Return a JSON array of objects with this exact shape:
[{"title":"Milestone title","content":"Detailed milestone requirements"}]`,
      },
    ],
    {
      systemPrompt:
        "You are a senior delivery architect for a software agency. Produce realistic, implementation-ready milestone plans with clear deliverables and quality gates. Prioritize depth and specificity over brevity. Return only valid JSON and no reasoning traces.",
      temperature: 0.2,
      taskType: "structured_json",
      model: process.env.GROQ_MODEL_COMPLEX,
      jsonExample:
        '[{"title":"Discovery & Planning","content":"## Scope\\n- Confirm business goals\\n- Finalize technical constraints\\n\\n## Deliverables\\n- Approved requirements\\n- Architecture draft\\n\\n## Acceptance Criteria\\n1. Stakeholders sign off scope\\n2. Risks and dependencies documented"}]',
    }
  );

  if (!milestones || !Array.isArray(milestones)) {
    return NextResponse.json(
      { error: "AI failed to generate milestones. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ data: milestones });
});

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { callAIJson } from "@/lib/ai/ai";
import { getSignedUrl } from "@/lib/storage/supabase-storage";

const pdfParseModule = require("pdf-parse");
const pdfParse = pdfParseModule.default || pdfParseModule;

export const dynamic = "force-dynamic";

const Schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  pdfUrl: z.string().optional(),
  existingMilestones: z.array(z.object({ title: z.string(), content: z.string().optional() })).optional(),
});

interface AIMilestone {
  title: string;
  content: string;
}

export const POST = apiHandler(async (req: NextRequest) => {
  const role = req.headers.get("x-user-role") ?? "";
  if (!["ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

  const body = (await req.json()) as unknown;
  const { title, description, pdfUrl, existingMilestones } = Schema.parse(body);
  const existingText = existingMilestones?.length 
    ? `\n\nExisting Draft Milestones (please improve and expand these):\n${existingMilestones.map((m, i) => `[${i+1}] ${m.title}${m.content ? `\n${m.content}` : ""}`).join("\n\n")}`
    : "";

  // Fetch and parse PDF content if provided
  let pdfContent = "";
  if (pdfUrl) {
    try {
      const signedUrl = await getSignedUrl(pdfUrl, 600); // 10 min expiry
      const response = await fetch(signedUrl);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const parsed = await pdfParse(buffer);
        pdfContent = parsed.text.substring(0, 10000); // Limit to 10k chars
      }
    } catch (e) {
      console.log("Failed to parse PDF, continuing without PDF content");
    }
  }

  const pdfContext = pdfContent
    ? `\n\n[CLIENT SUBMITTED PDF BRIEF - EXTRACTED CONTENT]:\n${pdfContent}\n\nAnalyze this PDF thoroughly for requirements, constraints, deliverables, and implicit scope boundaries.`
    : pdfUrl
      ? `\n\n[CLIENT SUBMITTED PDF: A PDF brief was submitted but could not be parsed. Please proceed based on the project description.]`
      : "";

  const milestones = await callAIJson<AIMilestone[]>(
    [
      {
        role: "user",
        content: `Create a milestone plan for this software project.${existingText}${pdfContext}

Project: ${title}
Description: ${description}

Guidelines:
- 3-5 milestones typically, more only if the project genuinely needs them
- Order: discovery → development → launch
- Each milestone should tell a story: what we're doing, why it matters, what "done" looks like
- Include key activities, deliverables, and acceptance criteria
- Note scope boundaries when there's ambiguity (what's NOT included)
- Write naturally - like explaining to a colleague, not filling out a template
- Be specific: "Build user authentication with email + OAuth" not "Work on auth"

FORMATTING - IMPORTANT:
The "content" field will be rendered as rich text. Use proper markdown:
- Use ## for main sections (## Overview, ## Deliverables, etc.)
- Use bullet lists (- item) for listing features and tasks
- Use numbered lists (1. item) for sequential steps
- Use **bold** for emphasis on key terms
- Use proper line breaks between sections

This markdown will be parsed into styled blocks (headings, lists, paragraphs).

Return JSON array:
[{"title":"Milestone title","content":"## Overview\\nDescription with **bold** and lists\\n\\n## Activities\\n- Activity one\\n- Activity two"}]`,
      },
    ],
    {
      systemPrompt:
        "You are a senior delivery architect. Create practical milestone plans that provide clear direction without rigid structure. Write naturally and focus on what matters for execution. Be specific, not academic.",
      temperature: 0.3,
      taskType: "planning", // Uses reasoning models from env config
      jsonExample:
        '[{"title":"Discovery & Planning","content":"**Goal:** Understand the current state and design the technical foundation.\n\n**Key Activities:**\n- Audit existing systems and documentation\n- Interview stakeholders to confirm requirements\n- Design architecture and data models\n- Define API contracts\n\n**Deliverables:**\n- Technical specification document\n- Architecture diagrams\n- API contract drafts\n- Risk assessment\n\n**Done when:** Stakeholders approve the architecture and all APIs are documented.\n\n**Not included:** Actual implementation - this phase is planning only."}]',
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

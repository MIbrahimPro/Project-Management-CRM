import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { callAIJson } from "@/lib/ai/ai";
import { getSignedUrl } from "@/lib/storage/supabase-storage";

const pdfParseModule = require("pdf-parse");
const pdfParse = pdfParseModule.default || pdfParseModule;

const mammoth = require("mammoth");

export const dynamic = "force-dynamic";

const Schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  pdfUrl: z.string().optional(),
  existingMilestones: z.array(z.object({ title: z.string(), content: z.string().optional() })).optional(),
});

interface AIMilestoneWithQuestions {
  title: string;
  content: string;
  questions: string[];
}

interface AIResponse {
  milestones: AIMilestoneWithQuestions[];
  generalQuestions: { text: string; partOf: string }[];
}

export const POST = apiHandler(async (req: NextRequest) => {
  const role = req.headers.get("x-user-role") ?? "";
  if (!["ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

  const body = (await req.json()) as unknown;
  const { title, description, pdfUrl, existingMilestones } = Schema.parse(body);

  const existingText = existingMilestones?.length
    ? `\n\nExisting Draft Milestones (improve and expand these):\n${existingMilestones.map((m, i) => `[${i + 1}] ${m.title}${m.content ? `\n${m.content}` : ""}`).join("\n\n")}`
    : "";

  // Fetch and parse file content if provided
  let fileContent = "";
  let fileLabel = "PDF";
  if (pdfUrl) {
    try {
      const signedUrl = await getSignedUrl(pdfUrl, 600);
      const response = await fetch(signedUrl);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const lower = pdfUrl.toLowerCase();
        if (lower.endsWith(".pdf")) {
          const parsed = await pdfParse(buffer);
          fileContent = parsed.text.substring(0, 10000);
          fileLabel = "PDF";
        } else if (lower.endsWith(".docx")) {
          const result = await mammoth.extractRawText({ buffer });
          fileContent = result.value.substring(0, 10000);
          fileLabel = "DOCX";
        } else if (lower.endsWith(".md") || lower.endsWith(".txt")) {
          fileContent = buffer.toString("utf-8").substring(0, 10000);
          fileLabel = lower.endsWith(".md") ? "MD" : "TXT";
        } else {
          // Fallback: try pdf-parse first, then try as text
          try {
            const parsed = await pdfParse(buffer);
            fileContent = parsed.text.substring(0, 10000);
            fileLabel = "PDF";
          } catch {
            fileContent = buffer.toString("utf-8").substring(0, 10000);
            fileLabel = "Text";
          }
        }
      }
    } catch (e) {
      console.log("Failed to parse file, continuing without file content");
    }
  }

  const fileContext = fileContent
    ? `\n\n[CLIENT SUBMITTED ${fileLabel} BRIEF - EXTRACTED CONTENT]:\n${fileContent}\n\nAnalyze this ${fileLabel} thoroughly for requirements, constraints, deliverables, and implicit scope boundaries.`
    : pdfUrl
      ? `\n\n[CLIENT SUBMITTED FILE: A ${fileLabel} brief was submitted but could not be parsed. Please proceed based on the project description.]`
      : "";

  const systemPrompt = `You are an ELITE SENIOR DELIVERY ARCHITECT with 20+ years of software project management experience.

Your task: Create practical milestone plans that provide clear direction without overwhelming structure.

PRINCIPLES:
1. BE NATURAL - Write milestones as you'd explain them to a colleague, not a rigid template
2. COVER THE ESSENTIALS - What needs to happen, why it matters, and what "done" looks like
3. SCOPE BOUNDARIES - Note what's NOT included when there's ambiguity
4. BE CONCISE - 2-3 rich paragraphs per milestone beats 8 sections of filler

QUESTION STRATEGY - BE SPARING:
Only ask questions when there's a GENUINE gap that blocks planning:
- Missing credentials/secrets ("Please add API keys to the vault and reply 'done'")
- Unclear technical constraints that affect architecture
- Undefined access requirements (databases, third-party accounts)
- Logical gaps in the project description

DON'T ask about: general goals, timeline preferences, or things already stated.`;

  const userPrompt = `Create a milestone plan for this project. Write naturally and practically.

PROJECT: ${title}
DESCRIPTION: ${description}${fileContext}${existingText}

MILESTONE GUIDANCE:
Each milestone should tell a story:
- What we're accomplishing and why it matters
- Key activities and deliverables  
- What "done" looks like (acceptance criteria)
- Any dependencies or blockers
- What's NOT included if there's ambiguity
- Keep it as detailed as possible so we know exactly what needs to be done and nothing comes up out of scope
- Present time estimates per milestone
- Keep milestones reasonably sized (unless a task genuinely can't be divided)
- It should be professional documentation - anyone reading it should know exactly what will be built and how

FORMATTING INSTRUCTIONS:
The milestone "content" will be rendered as rich text in a document editor. Use proper markdown:
- ## for main sections, ### for subsections, #### for sub-subsections
- **bold** for key terms, *italic* for emphasis
- \`inline code\` for technical terms, file names, API endpoints, CLI commands
- \`\`\`language blocks for multi-line code snippets
- > blockquotes for important notes, warnings, or callouts
- --- horizontal dividers between major sections
- - bullet lists for features, tasks, requirements
- 1. numbered lists for sequential steps or priorities
- | Tables | for | structured | data | when helpful

Use line breaks between sections for readability. The content will be parsed into styled blocks.

QUESTIONS - ONLY IF NEEDED:
For each milestone, consider: "Is there a critical missing piece that would block execution?"

Ask questions ONLY for:
1. **Missing secrets/credentials** - "This milestone requires [API/service]. Please add credentials to the Secrets section and reply 'done'."
2. **Access requirements** - "Will we need database access, admin accounts, or third-party logins?"
3. **Logical gaps** - "You mentioned X but not Y - is Y handled elsewhere or out of scope?"
4. **Technical constraints** - "Any specific performance, compliance, or integration constraints?"
5. **COnfirming the TEchnologies USed*** -  "ANy technology that needs to be used that has alternatives that may effect the client,, HOWEVER, try to suggest one,, or just pick one up and dont ask, when you can, try to pick the one easiest work on and cheap to operate, especially ones on which AI can help to work on"

If the project description is clear and complete, return an empty questions array. Less is more.

OUTPUT FORMAT - Return valid JSON:
{
  "milestones": [
    {
      "title": "Milestone name",
      "content": "Full markdown-formatted content with ## Headings, bullet lists, **bold** text, etc. This will be parsed into rich document blocks.",
      "questions": ["Only genuine blocking questions - often 0"]
    }
  ],
  "generalQuestions": [
    {"text": "Only if something fundamental is missing", "partOf": "Category"}
  ]
}

IMPORTANT: The "content" field should use proper markdown that will be parsed. Example structure:
## Overview\nBrief description of this milestone...\n\n## Key Activities\n- Activity one\n- Activity two\n\n## Deliverables\n- Deliverable one\n- Deliverable two\n\n## Acceptance Criteria\n1. Criteria one\n2. Criteria two\n\n## Out of Scope\n- What is NOT included

RULES:
- 3-5 milestones typically, more if the project genuinely needs them
- Order: discovery → development → deployment
- Be practical, not academic
- Empty question arrays are fine if everything is clear`

  const result = await callAIJson<AIResponse>(
    [{ role: "user", content: userPrompt }],
    {
      systemPrompt,
      temperature: 0.3,
      taskType: "planning", // Uses reasoning models (DeepSeek-R1, Nemotron)
      maxTokens: 8000, // Reasoning models need more tokens for detailed output
      jsonExample: JSON.stringify({
        milestones: [
          {
            title: "Discovery & Architecture",
            content: "We'll start by understanding the current state and designing the foundation.\n\n**Key Activities:**\n- Technical audit of existing systems\n- Architecture diagrams and data flow\n- API design and integration points\n\n**Deliverables:**\n- Technical specification document\n- Architecture diagrams\n- API contract drafts\n\n**Done when:** Architecture is approved and APIs are documented.\n\n**Out of scope:** Actual implementation - this is planning only.",
            questions: ["Please add any existing API documentation to the project vault and reply 'done'."]
          }
        ],
        generalQuestions: [{ text: "Are there any compliance requirements (GDPR, HIPAA, SOC2)?", partOf: "Compliance" }]
      }),
    }
  );

  if (!result || !result.milestones) {
    return NextResponse.json(
      { error: "AI failed to generate comprehensive plan. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ data: result });
});

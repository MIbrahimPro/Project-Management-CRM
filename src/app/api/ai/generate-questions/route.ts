import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { callAIJson } from "@/lib/ai";

export const dynamic = "force-dynamic";

const Schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  milestones: z.array(z.object({ title: z.string() })).optional(),
});

interface AIQuestion {
  text: string;
  partOf: string;
}

export const POST = apiHandler(async (req: NextRequest) => {
  const role = req.headers.get("x-user-role") ?? "";
  if (!["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

  const body = (await req.json()) as unknown;
  const { title, description, milestones } = Schema.parse(body);

  const milestoneList = milestones?.map((m) => m.title).join(", ") ?? "";

  const questions = await callAIJson<AIQuestion[]>(
    [
      {
        role: "user",
        content: `Generate 3–5 high-signal, high-value clarifying questions to ask a client before starting this project. Focus on critical missing details, dependencies, and business goals. Avoid generic questions.\n\nProject: ${title}\nDescription: ${description}${milestoneList ? `\nMilestones: ${milestoneList}` : ""}\n\nReturn a JSON array of objects with "text" (the question) and "partOf" (which aspect of the project it relates to, e.g. "Discovery", "Scope", "Technical", "Timeline").`,
      },
    ],
    {
      systemPrompt:
        "You are a project discovery expert. Generate smart, actionable questions that uncover requirements and prevent scope creep.",
      maxTokens: 800,
      temperature: 0.4,
      taskType: "structured_json",
      jsonExample:
        '[{"text":"Who are the primary users for this feature?","partOf":"Scope"}]',
    }
  );

  if (!questions || !Array.isArray(questions)) {
    return NextResponse.json(
      { error: "AI failed to generate questions. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ data: questions });
});

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { callAI } from "@/lib/ai";

export const dynamic = "force-dynamic";

const HR_ROLES = ["ADMIN", "PROJECT_MANAGER", "HR"];

const bodySchema = z.object({
  candidateId: z.string(),
});

// POST /api/ai/hr-notes — generate internal notes for a candidate based on their answers
export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!HR_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const { candidateId } = bodySchema.parse(await req.json());

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      request: {
        select: { statedRole: true, publicTitle: true, description: true },
      },
      answers: {
        include: { question: { select: { text: true } } },
      },
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const answersText = candidate.answers
    .map((a: { question: { text: string }; answer: string }) => `Q: ${a.question.text}\nA: ${a.answer}`)
    .join("\n\n");

  const prompt = `
Role applied for: ${candidate.request.publicTitle ?? candidate.request.statedRole}
Candidate name: ${candidate.name}
Email: ${candidate.email}

Application answers:
${answersText || "No answers provided"}

Please write concise internal HR notes for this candidate covering:
1. First impression based on answers
2. Key strengths observed
3. Potential concerns or gaps
4. Recommended next step (phone screen / technical interview / reject)

Keep it objective and professional. Maximum 200 words.
`.trim();

  const notes = await callAI(
    [{ role: "user", content: prompt }],
    {
      systemPrompt: "You are an HR professional writing internal candidate evaluation notes.",
      maxTokens: 500,
      temperature: 0.5,
      taskType: "hr",
    }
  );

  return NextResponse.json({ data: { notes } });
});

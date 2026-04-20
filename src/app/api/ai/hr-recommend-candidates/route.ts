import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { callAIJson } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const HR_ROLES = ["ADMIN", "PROJECT_MANAGER", "HR"];

const bodySchema = z.object({
  requestId: z.string(),
});

interface AIRanking {
  candidateId: string;
  name: string;
  score: number; // 1-10
  reasoning: string;
}

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!HR_ROLES.includes(userRole)) forbidden();

  const { requestId } = bodySchema.parse(await req.json());

  const request = await prisma.hiringRequest.findUnique({
    where: { id: requestId },
    select: {
      statedRole: true,
      publicDescription: true,
      questions: { orderBy: { order: "asc" }, select: { id: true, text: true } },
      candidates: {
        where: { status: { notIn: ["HIRED", "REJECTED"] } },
        select: {
          id: true,
          name: true,
          answers: {
            select: {
              answer: true,
              question: { select: { text: true } },
            },
          },
        },
      },
    },
  });
  if (!request) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  if (request.candidates.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const candidatesSummary = request.candidates.map((c) => {
    const answers = c.answers
      .map((a) => `Q: ${a.question.text}\nA: ${a.answer}`)
      .join("\n\n");
    return `Candidate ID: ${c.id}\nName: ${c.name}\n${answers || "(no answers)"}`;
  }).join("\n\n---\n\n");

  const prompt = `You are an HR expert evaluating candidates for a ${request.statedRole} position.

Job description: ${request.publicDescription ?? "Not provided"}

Evaluate the following candidates based on their application answers. Score each from 1-10 (10 = best fit). Return a JSON array sorted by score descending.

Candidates:
${candidatesSummary}

Return ONLY a JSON array of objects with these exact fields:
[{ "candidateId": "...", "name": "...", "score": 8, "reasoning": "One sentence" }]`;

  const rankings = await callAIJson<AIRanking[]>(
    [{ role: "user", content: prompt }],
    {
      maxTokens: 800,
      temperature: 0.2,
      taskType: "structured_json",
      jsonExample:
        '[{"candidateId":"cand_123","name":"Jane Doe","score":8,"reasoning":"Strong role fit and clear communication."}]',
    }
  );

  if (!rankings) {
    return NextResponse.json({ error: "AI failed to rank candidates", code: "AI_ERROR" }, { status: 500 });
  }

  // Mark top candidates as AI_RECOMMENDED in DB (score >= 7)
  const topIds = rankings.filter((r) => r.score >= 7).map((r) => r.candidateId);
  if (topIds.length > 0) {
    await prisma.candidate.updateMany({
      where: { id: { in: topIds }, requestId },
      data: { isAiRecommended: true },
    });
  }

  return NextResponse.json({ data: rankings });
});

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

const MAX_CV_SIZE = 10 * 1024 * 1024; // 10 MB

async function verifyCaptcha(token: string): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET_KEY;
  if (!secret) return false;
  try {
    const res = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, ctx: { params: { slug: string } }) {
  const { slug } = ctx.params;

  // Find open job
  const request = await prisma.hiringRequest.findUnique({
    where: { publicSlug: slug, status: "OPEN" },
    select: {
      id: true,
      questions: { select: { id: true, required: true } },
    },
  });
  if (!request) {
    return NextResponse.json({ error: "Job not found or closed", code: "NOT_FOUND" }, { status: 404 });
  }

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  // Captcha validation
  const captchaToken = formData.get("captchaToken") as string | null;
  if (!captchaToken) {
    return NextResponse.json({ error: "Captcha required", code: "CAPTCHA_REQUIRED" }, { status: 400 });
  }
  const captchaOk = await verifyCaptcha(captchaToken);
  if (!captchaOk) {
    return NextResponse.json({ error: "Captcha verification failed", code: "CAPTCHA_INVALID" }, { status: 400 });
  }

  // Basic fields
  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const phone = (formData.get("phone") as string | null)?.trim() || null;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  // Check for duplicate application
  const existing = await prisma.candidate.findFirst({
    where: { requestId: request.id, email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "You have already applied for this position", code: "CONFLICT" }, { status: 409 });
  }

  // CV upload (optional)
  let cvUrl: string | null = null;
  const cvFile = formData.get("cv") as File | null;
  if (cvFile && cvFile.size > 0) {
    if (cvFile.size > MAX_CV_SIZE) {
      return NextResponse.json({ error: "CV file must be under 10 MB", code: "VALIDATION_ERROR" }, { status: 400 });
    }
    const ext = cvFile.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const buffer = Buffer.from(await cvFile.arrayBuffer());
    const path = `cv-files/${request.id}-${Date.now()}.${ext}` as const;
    await uploadFile(buffer, path, cvFile.type || "application/pdf");
    cvUrl = path;
  }

  // Parse answers
  const answers: { questionId: string; answer: string }[] = [];
  for (const q of request.questions) {
    const answer = (formData.get(`answer_${q.id}`) as string | null)?.trim() ?? "";
    if (q.required && !answer) {
      return NextResponse.json({
        error: `Answer required for question ${q.id}`,
        code: "VALIDATION_ERROR",
      }, { status: 400 });
    }
    if (answer) {
      answers.push({ questionId: q.id, answer });
    }
  }

  // Create candidate
  const candidate = await prisma.candidate.create({
    data: {
      requestId: request.id,
      name,
      email,
      phone,
      cvUrl,
      answers: {
        create: answers.map((a) => ({
          questionId: a.questionId,
          answer: a.answer,
        })),
      },
    },
    select: { id: true, name: true, email: true },
  });

  // Emit real-time event for HR dashboard
  try {
    const io = (globalThis as Record<string, unknown>).io as
      | { to: (room: string) => { emit: (event: string, data: unknown) => void } }
      | undefined;
    if (io) {
      // Notify all HR users via the notifications namespace
      const hrUsers = await prisma.user.findMany({
        where: { role: { in: ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "HR"] }, isActive: true },
        select: { id: true },
      });
      for (const u of hrUsers) {
        io.to(`user:${u.id}`).emit("new_candidate", {
          requestId: request.id,
          candidateId: candidate.id,
          candidateName: candidate.name,
        });
      }
    }
  } catch { /* non-critical */ }

  return NextResponse.json({ data: { candidateId: candidate.id } }, { status: 201 });
}

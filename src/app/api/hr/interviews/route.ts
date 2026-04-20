import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const HR_ROLES = ["ADMIN", "PROJECT_MANAGER", "HR"];

const resend = new Resend(process.env.RESEND_API_KEY);

export const GET = apiHandler(async (req: NextRequest) => {
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!HR_ROLES.includes(userRole)) forbidden();

  const interviews = await prisma.interview.findMany({
    where: { status: "SCHEDULED" },
    include: {
      interviewers: { select: { id: true, name: true, profilePicUrl: true } },
      candidate: { select: { id: true, name: true, email: true } }
    },
    orderBy: { startTime: "asc" }
  });

  return NextResponse.json({ data: interviews });
});

const createSchema = z.object({
  candidateId: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  interviewerIds: z.array(z.string()).min(1),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!HR_ROLES.includes(userRole)) forbidden();

  const body = createSchema.parse(await req.json());
  
  const start = new Date(body.startTime);
  const end = new Date(body.endTime);
  if (start >= end) {
    return NextResponse.json({ error: "End time must be after start time", code: "INVALID_TIME" }, { status: 400 });
  }

  // Conflict check for interviewers
  const conflicts = await prisma.interview.findFirst({
    where: {
      status: "SCHEDULED",
      interviewers: { some: { id: { in: body.interviewerIds } } },
      OR: [
        { startTime: { lt: end, gte: start } },
        { endTime: { gt: start, lte: end } },
        { startTime: { lte: start }, endTime: { gte: end } }
      ]
    },
    include: { interviewers: { select: { name: true } } }
  });

  if (conflicts) {
    return NextResponse.json({ 
      error: "One or more selected interviewers are busy during this time", 
      code: "CONFLICT" 
    }, { status: 409 });
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: body.candidateId },
    select: { id: true, name: true, email: true, requestId: true, request: { select: { statedRole: true } } }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const interview = await prisma.$transaction(async (tx) => {
    const newInterview = await tx.interview.create({
      data: {
        candidateId: body.candidateId,
        startTime: start,
        endTime: end,
        interviewers: { connect: body.interviewerIds.map(id => ({ id })) }
      },
      include: {
        interviewers: { select: { name: true, email: true } }
      }
    });

    await tx.candidate.update({
      where: { id: body.candidateId },
      data: { status: "INTERVIEW_SCHEDULED", interviewAt: start }
    });

    return newInterview;
  });

  // Send Email
  try {
    const formattedDate = start.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const formattedTime = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    const interviewerNames = interview.interviewers.map(i => i.name).join(", ");
    
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "interviews@devrolin.com",
      to: candidate.email,
      subject: `Interview Scheduled: ${candidate.request.statedRole}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-w-[600px] margin: 0 auto;">
          <h2>Interview Scheduled</h2>
          <p>Hi ${candidate.name},</p>
          <p>We are excited to invite you for an interview for the <strong>${candidate.request.statedRole}</strong> position at DevRolin.</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${formattedDate}</p>
            <p style="margin: 0 0 8px 0;"><strong>Time:</strong> ${formattedTime}</p>
            <p style="margin: 0;"><strong>Interviewers:</strong> ${interviewerNames}</p>
          </div>
          <p>We will send you a meeting link 10 minutes before the interview starts.</p>
          <p>Best,<br>The DevRolin Team</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send interview email", err);
  }

  return NextResponse.json({ data: interview });
});

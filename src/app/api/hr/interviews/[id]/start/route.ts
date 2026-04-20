import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

const HR_ROLES = ["ADMIN", "PROJECT_MANAGER", "HR"];
const resend = new Resend(process.env.RESEND_API_KEY);

export const POST = apiHandler(async (req: NextRequest, ctx) => {
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!HR_ROLES.includes(userRole)) forbidden();

  const interviewId = ctx?.params?.id;
  if (!interviewId) {
    return NextResponse.json({ error: "Missing interview ID", code: "INVALID_INPUT" }, { status: 400 });
  }

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      candidate: { select: { id: true, name: true, email: true, request: { select: { statedRole: true } } } },
      interviewers: { select: { name: true } }
    }
  });

  if (!interview) {
    return NextResponse.json({ error: "Interview not found", code: "NOT_FOUND" }, { status: 404 });
  }

  if (interview.roomId) {
    // Already started, just return the existing room ID
    return NextResponse.json({ data: { roomId: interview.roomId } });
  }

  // Generate a unique room ID
  const roomId = uuidv4();

  await prisma.interview.update({
    where: { id: interviewId },
    data: { roomId }
  });

  // Send the "Starting Now" email to the candidate
  try {
    const meetLink = `${process.env.NEXT_PUBLIC_APP_URL}/meet/${roomId}`;
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "interviews@devrolin.com",
      to: interview.candidate.email,
      subject: `Join your Interview: ${interview.candidate.request.statedRole}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-w-[600px] margin: 0 auto;">
          <h2>Your Interview is Starting</h2>
          <p>Hi ${interview.candidate.name},</p>
          <p>Your interviewers are ready for you in the virtual meeting room.</p>
          <div style="margin: 24px 0;">
            <a href="${meetLink}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Join Meeting Now
            </a>
          </div>
          <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:<br>
          <a href="${meetLink}">${meetLink}</a></p>
          <p>Best,<br>The DevRolin Team</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send start meeting email", err);
  }

  return NextResponse.json({ data: { roomId } });
});

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const HR_ROLES = ["ADMIN", "PROJECT_MANAGER", "HR"];
const resend = new Resend(process.env.RESEND_API_KEY);

const bodySchema = z.object({
  salary: z.string().min(1),
  workMode: z.enum(["ONSITE", "REMOTE", "HYBRID"]),
  memberSince: z.string().datetime(),
});

export const POST = apiHandler(async (req: NextRequest, ctx) => {
  const userRole = req.headers.get("x-user-role") ?? "";
  const createdById = req.headers.get("x-user-id");
  if (!HR_ROLES.includes(userRole) || !createdById) forbidden();

  const requestId = ctx?.params?.id;
  const candidateId = ctx?.params?.cId;
  if (!requestId || !candidateId) {
    return NextResponse.json({ error: "Missing IDs", code: "INVALID_INPUT" }, { status: 400 });
  }

  const body = bodySchema.parse(await req.json());

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId, requestId },
    include: { request: { select: { role: true, statedRole: true } } }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found", code: "NOT_FOUND" }, { status: 404 });
  }

  if (candidate.status === "HIRED") {
    return NextResponse.json({ error: "Candidate is already hired", code: "ALREADY_HIRED" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: candidate.email }
  });

  if (existingUser) {
    return NextResponse.json({ error: "Email is already registered in the system", code: "EMAIL_TAKEN" }, { status: 409 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const user = await prisma.$transaction(async (tx) => {
    // 1. Mark candidate as HIRED
    await tx.candidate.update({
      where: { id: candidateId },
      data: { status: "HIRED" }
    });

    // 2. Create the User record (without password)
    const newUser = await tx.user.create({
      data: {
        email: candidate.email,
        name: candidate.name,
        phone: candidate.phone || "",
        role: candidate.request.role as any,
        statedRole: candidate.request.statedRole,
        workMode: body.workMode,
        salary: body.salary,
        createdAt: new Date(body.memberSince),
        isActive: true, // They need to accept invite to set password, but record is active
      }
    });

    // 3. Upsert NotificationPreference
    await tx.notificationPreference.upsert({
      where: { userId: newUser.id },
      update: {},
      create: { userId: newUser.id },
    });

    // 4. Create Invitation
    await tx.invitation.create({
      data: {
        email: candidate.email,
        role: candidate.request.role as any,
        token,
        invitedBy: createdById!,
        expiresAt,
      }
    });

    return newUser;
  });

  // 5. Send Welcome Email via Resend
  try {
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@devrolin.com",
      to: candidate.email,
      subject: `Welcome to DevRolin! Action Required`,
      html: `
        <div style="font-family: Arial, sans-serif; max-w-[600px] margin: 0 auto; color: #333;">
          <h2 style="color: #0ea5e9;">Welcome aboard, ${candidate.name}!</h2>
          <p>We are thrilled to welcome you to the DevRolin team as our new <strong>${candidate.request.statedRole}</strong>.</p>
          <p>Your account has been created. To get started and access your team workspace, please click the button below to accept your invitation and securely set your password.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${inviteLink}" style="background-color: #0ea5e9; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Complete Account Setup
            </a>
          </div>
          <p style="font-size: 14px; color: #666;">If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${inviteLink}">${inviteLink}</a></p>
          <p style="font-size: 14px; color: #666;">This link expires in 7 days.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send welcome email", err);
  }

  return NextResponse.json({ data: user });
});

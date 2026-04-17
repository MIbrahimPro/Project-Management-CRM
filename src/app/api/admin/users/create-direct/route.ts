import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/audit";
import { requireUserManagement } from "@/lib/admin-user-management";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

const bodySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum([
    "ADMIN", "PROJECT_MANAGER", "DEVELOPER",
    "DESIGNER", "HR", "ACCOUNTANT", "SALES", "CLIENT",
  ]),
  workMode: z.enum(["REMOTE", "ONSITE", "HYBRID"]).default("REMOTE"),
  statedRole: z.string().max(100).optional(),
});

function generatePassword(): string {
  // 16 chars: letters + digits + symbols
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  return Array.from(randomBytes(16))
    .map((b) => chars[b % chars.length])
    .join("");
}

// POST /api/admin/users/create-direct — create user with auto-generated password, email credentials
export async function POST(req: NextRequest) {
  const guard = requireUserManagement(req);
  if (guard) return guard;
  const adminId = req.headers.get("x-user-id")!;

  const body = bodySchema.parse(await req.json());

  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use", code: "CONFLICT" }, { status: 409 });
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        role: body.role,
        workMode: body.workMode,
        statedRole: body.statedRole,
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true },
    });
    await tx.notificationPreference.create({ data: { userId: newUser.id } });
    return newUser;
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Send welcome email with credentials
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
    to: user.email,
    subject: "Welcome to DevRolin CRM",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Welcome to DevRolin, ${user.name}!</h2>
        <p>Your account has been created. Here are your login credentials:</p>
        <table style="margin:16px 0;border-collapse:collapse">
          <tr>
            <td style="padding:8px;font-weight:bold;color:#666">Email:</td>
            <td style="padding:8px">${user.email}</td>
          </tr>
          <tr>
            <td style="padding:8px;font-weight:bold;color:#666">Password:</td>
            <td style="padding:8px;font-family:monospace;font-size:16px">${password}</td>
          </tr>
          <tr>
            <td style="padding:8px;font-weight:bold;color:#666">Role:</td>
            <td style="padding:8px">${user.role}</td>
          </tr>
        </table>
        <p><a href="${appUrl}/login" style="background:#f97316;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;display:inline-block">Login to DevRolin</a></p>
        <p style="color:#666;font-size:12px">Please change your password after your first login.</p>
      </div>
    `,
  });

  await logAction(adminId, "ADMIN_CREATE_USER", "User", user.id, { email: user.email, role: user.role });
  return NextResponse.json({ data: user }, { status: 201 });
}

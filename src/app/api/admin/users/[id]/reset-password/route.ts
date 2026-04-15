import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/audit";
import { projectManagerCannotModifyUser, requireUserManagement } from "@/lib/admin-user-management";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/admin/users/[id]/reset-password — trigger password reset email for user
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireUserManagement(req);
  if (guard) return guard;
  const adminId = req.headers.get("x-user-id")!;
  const actorRole = req.headers.get("x-user-role") ?? "";

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  if (user.role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Cannot reset SUPER_ADMIN password", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  if (projectManagerCannotModifyUser(actorRole, user.role)) {
    return NextResponse.json(
      { error: "Cannot reset administrator password", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  // Create OTP token
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await prisma.otpToken.create({
    data: { userId: user.id, otpHash, purpose: "password_reset", expiresAt },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
    to: user.email,
    subject: "Password Reset Request — DevRolin",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Password Reset</h2>
        <p>Hi ${user.name},</p>
        <p>An administrator has requested a password reset for your account.</p>
        <p>Your one-time code is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0;padding:12px 24px;background:#f5f5f5;display:inline-block;border-radius:8px">${otp}</div>
        <p>This code expires in 10 minutes.</p>
        <p><a href="${appUrl}/otp?email=${encodeURIComponent(user.email)}&purpose=password_reset">Enter code here</a></p>
        <p style="color:#666;font-size:12px">If you did not expect this, please contact your administrator.</p>
      </div>
    `,
  });

  await logAction(adminId, "ADMIN_RESET_PASSWORD", "User", params.id);
  return NextResponse.json({ data: { sent: true } });
}

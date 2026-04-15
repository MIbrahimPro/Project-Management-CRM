import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const token = ctx?.params?.token;

  if (!token) {
    return NextResponse.json({ error: "Invitation token required", code: "INVALID_TOKEN" }, { status: 400 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found", code: "NOT_FOUND" }, { status: 404 });
  }

  if (invitation.acceptedAt) {
    return NextResponse.json({ error: "This invitation has already been accepted", code: "ALREADY_ACCEPTED" }, { status: 400 });
  }

  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation has expired", code: "EXPIRED" }, { status: 410 });
  }

  const inviter = await prisma.user.findUnique({
    where: { id: invitation.invitedBy },
    select: { name: true, email: true },
  });

  return NextResponse.json({
    data: {
      email: invitation.email,
      role: invitation.role,
      inviterName: inviter?.name || "Unknown",
      inviterEmail: inviter?.email || "",
      expiresAt: invitation.expiresAt,
    },
  });
});

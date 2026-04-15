import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateAccessToken, generateRefreshToken, hashToken, generateDeviceId, parseUserAgentFamily } from "@/lib/tokens";
import { setAuthCookies } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string(),
  name: z.string().min(2).max(100).regex(/^[a-zA-Z\s\-']+$/, "Name can only contain letters, spaces, hyphens, apostrophes"),
  password: z.string().min(8),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body = bodySchema.parse(await req.json());

  const invitation = await prisma.invitation.findUnique({
    where: { token: body.token },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invalid invitation token", code: "NOT_FOUND" }, { status: 404 });
  }
  if (invitation.acceptedAt) {
    return NextResponse.json({ error: "Invitation already used", code: "CONFLICT" }, { status: 409 });
  }
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation has expired", code: "EXPIRED" }, { status: 410 });
  }

  // Check if email already registered
  const existing = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered", code: "CONFLICT" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "";

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name: body.name,
        email: invitation.email,
        passwordHash,
        role: invitation.role,
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true },
    });

    // Upsert NotificationPreference
    await tx.notificationPreference.upsert({
      where: { userId: newUser.id },
      update: {},
      create: { userId: newUser.id },
    });

    // Mark invitation as accepted
    await tx.invitation.update({
      where: { token: body.token },
      data: { acceptedAt: new Date() },
    });

    return newUser;
  });

  // Create session & set cookies
  const deviceId = generateDeviceId();
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const accessToken = generateAccessToken(user.id, user.role);

  await prisma.session.create({
    data: {
      userId: user.id,
      deviceId,
      userAgentFamily: parseUserAgentFamily(userAgent),
      userAgent,
      ipAddress: ip,
      refreshToken: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const response = NextResponse.json({ data: { id: user.id, name: user.name, role: user.role } });
  setAuthCookies(response, refreshToken, accessToken);

  await logAction(user.id, "INVITE_ACCEPT", "User", user.id, { role: user.role }, ip);
  return response;
});

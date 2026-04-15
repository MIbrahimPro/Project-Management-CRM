import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const UserSettingsSchema = z
  .object({
    currencyPreference: z.enum(["USD", "PKR", "AUD", "GBP", "EUR", "CAD", "AED"]),
    clientColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
    workHoursStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:MM format")
      .nullable(),
    workHoursEnd: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:MM format")
      .nullable(),
  })
  .partial();

const NotifPrefsSchema = z
  .object({
    chatInWorkHours: z.boolean(),
    chatOutWorkHours: z.boolean(),
    meetingScheduled: z.boolean(),
    taskAssigned: z.boolean(),
    taskChanged: z.boolean(),
    awayCheck: z.boolean(),
    projectChatInWorkHours: z.boolean(),
    projectChatOutWorkHours: z.boolean(),
  })
  .partial();

export const PATCH = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const raw = await req.json() as Record<string, unknown>;

  // Separate notif prefs from user fields
  const {
    chatInWorkHours, chatOutWorkHours, meetingScheduled,
    taskAssigned, taskChanged, awayCheck,
    projectChatInWorkHours, projectChatOutWorkHours,
    theme: _theme, // stored client-side only, accepted but not persisted
    ...rest
  } = raw;

  const notifFields = NotifPrefsSchema.parse({
    chatInWorkHours, chatOutWorkHours, meetingScheduled,
    taskAssigned, taskChanged, awayCheck,
    projectChatInWorkHours, projectChatOutWorkHours,
  });

  const userUpdate = UserSettingsSchema.parse(rest);

  if (userUpdate.clientColor) {
    const hex = userUpdate.clientColor.toLowerCase();
    if (hex === "#ffffff" || hex === "#fff") {
      return NextResponse.json(
        { error: "Client color cannot be white", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
  }

  await Promise.all([
    Object.keys(userUpdate).length > 0
      ? prisma.user.update({ where: { id: userId }, data: userUpdate })
      : Promise.resolve(),
    Object.keys(notifFields).length > 0
      ? prisma.notificationPreference.upsert({
          where: { userId },
          create: { userId, ...notifFields },
          update: notifFields,
        })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ success: true });
});

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  profilePicUrl: true,
  phone: true,
  workMode: true,
  statedRole: true,
  workHoursStart: true,
  workHoursEnd: true,
  currencyPreference: true,
  clientColor: true,
  isGoogleConnected: true,
  isActive: true,
  createdAt: true,
  notifPreferences: {
    select: {
      chatInWorkHours: true,
      chatOutWorkHours: true,
      meetingScheduled: true,
      taskAssigned: true,
      taskChanged: true,
      awayCheck: true,
      projectChatInWorkHours: true,
      projectChatOutWorkHours: true,
    },
  },
};

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id")!;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT,
  });

  if (!user) {
    return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ data: user });
});

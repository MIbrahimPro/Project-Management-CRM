import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/supabase-storage";

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
  isGoogleConnected: true,
  currencyPreference: true,
  clientColor: true,
  workHoursStart: true,
  workHoursEnd: true,
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
  const userId = req.headers.get("x-user-id") ?? forbidden();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT,
  });

  if (!user) {
    return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
  }

  let avatarSignedUrl: string | null = null;
  if (user.profilePicUrl) {
    try {
      avatarSignedUrl = await getSignedUrl(user.profilePicUrl, 3600);
    } catch {
      avatarSignedUrl = null;
    }
  }

  return NextResponse.json({ data: { ...user, avatarSignedUrl } });
});

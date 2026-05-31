import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();

  await prisma.user.update({
    where: { id: userId },
    data: { isGoogleConnected: false, googleRefreshToken: null },
  });

  await logAction(userId, "GOOGLE_DISCONNECTED", "User", userId);

  return NextResponse.json({ success: true });
});

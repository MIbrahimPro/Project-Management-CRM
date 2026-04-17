import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { updateLastActive } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/confirm-active
 * Handles the response to an activity ping.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const pingId = req.nextUrl.searchParams.get("pingId");
  
  if (!userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!pingId) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const ping = await prisma.attendancePing.findUnique({
    where: { id: pingId },
    include: { checkIn: true }
  });

  if (ping && ping.checkIn.userId === userId && ping.status === "PENDING") {
    await prisma.attendancePing.update({
      where: { id: pingId },
      data: { status: "RESPONDED", respondedAt: new Date() }
    });
    
    // Refresh last active in Redis
    await updateLastActive(userId);
  }

  // Redirect to dashboard with a success param maybe?
  return NextResponse.redirect(new URL("/dashboard?activeConfirmed=true", req.url));
});

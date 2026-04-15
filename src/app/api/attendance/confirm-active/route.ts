import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/attendance/confirm-active?pingId=... — user taps push notification to confirm active
// Also accessible as a redirect URL from push, so returns a redirect to dashboard
export const GET = apiHandler(async (req: NextRequest) => {
  const pingId = req.nextUrl.searchParams.get("pingId");
  if (!pingId) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  await prisma.awayPing.update({
    where: { id: pingId },
    data: { respondedAt: new Date(), wasAway: false },
  }).catch(() => {}); // ignore if already responded or not found

  return NextResponse.redirect(new URL("/dashboard", req.url));
});

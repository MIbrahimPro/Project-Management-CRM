import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { getWorkHoursWarning } from "@/lib/work-hours";

export const dynamic = "force-dynamic";

// GET /api/users/[id]/work-hours-warning — returns warning if outside target user's work hours
export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const targetId = ctx?.params?.id;
  if (!targetId) return NextResponse.json({ warning: null });

  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: { name: true, workHoursStart: true, workHoursEnd: true },
  });

  if (!user) return NextResponse.json({ warning: null });

  const warning = getWorkHoursWarning(user);
  return NextResponse.json({ warning });
});

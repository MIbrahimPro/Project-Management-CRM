import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER", "HR"];

const querySchema = z.object({
  userId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
});

// GET /api/attendance — attendance records (managers see all, others see own)
export const GET = apiHandler(async (req: NextRequest) => {
  const currentUserId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");
  if (!currentUserId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  const isManager = MANAGER_ROLES.includes(role ?? "");
  const { userId, from, to, page } = querySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams)
  );

  const targetUserId = isManager && userId ? userId : currentUserId;
  const limit = 30;
  const skip = (page - 1) * limit;

  const where = {
    userId: targetUserId,
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [records, total] = await prisma.$transaction([
    prisma.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        date: true,
        status: true,
        note: true,
        user: { select: { id: true, name: true, profilePicUrl: true } },
      },
    }),
    prisma.attendance.count({ where }),
  ]);

  return NextResponse.json({
    data: records,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const HR_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "HR"];

const createSchema = z.object({
  statedRole: z.string().min(1).max(100),
  role: z.enum([
    "PROJECT_MANAGER", "DEVELOPER", "DESIGNER", "HR", "ACCOUNTANT", "SALES",
  ]),
  description: z.string().optional(),
  publicTitle: z.string().optional(),
  publicDescription: z.string().optional(),
  deadline: z.string().datetime().optional(),
  questions: z.array(z.object({ text: z.string(), required: z.boolean().default(true), order: z.number() })).optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!HR_ROLES.includes(userRole)) forbidden();

  const requests = await prisma.hiringRequest.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      statedRole: true,
      role: true,
      status: true,
      managerApproved: true,
      hrApproved: true,
      adminApproved: true,
      publicSlug: true,
      publicTitle: true,
      deadline: true,
      createdAt: true,
      requestedBy: { select: { id: true, name: true } },
      hr: { select: { id: true, name: true } },
      _count: { select: { candidates: true } },
    },
  });

  return NextResponse.json({ data: requests });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!HR_ROLES.includes(userRole)) forbidden();

  const body = createSchema.parse(await req.json());

  const request = await prisma.$transaction(async (tx) => {
    const req = await tx.hiringRequest.create({
      data: {
        requestedById: userId,
        role: body.role,
        statedRole: body.statedRole,
        description: body.description,
        publicTitle: body.publicTitle,
        publicDescription: body.publicDescription,
        deadline: body.deadline ? new Date(body.deadline) : null,
        questions: body.questions
          ? {
              create: body.questions.map((q) => ({
                text: q.text,
                required: q.required,
                order: q.order,
              })),
            }
          : undefined,
      },
      select: {
        id: true,
        statedRole: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // Create a hiring chat room for this request
    await tx.chatRoom.create({
      data: {
        name: `Hiring: ${body.statedRole}`,
        type: "hiring_group",
        hiringRequestId: req.id,
        members: { create: [{ userId }] },
      },
    });

    return req;
  });

  await logAction(userId, "HIRING_REQUEST_CREATED", "HiringRequest", request.id, {
    statedRole: body.statedRole,
  });

  return NextResponse.json({ data: request }, { status: 201 });
});

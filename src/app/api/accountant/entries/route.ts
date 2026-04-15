import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { logAction } from "@/lib/audit";
import { uploadFile } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"];

const entrySchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.enum([
    "SALARY", "PROJECT_PAYMENT", "HOSTING", "DOMAIN",
    "SOFTWARE", "OFFICE", "MARKETING", "MISCELLANEOUS",
  ]),
  amountUsd: z.number().positive(),
  originalAmount: z.number().positive().optional(),
  originalCurrency: z.string().length(3).optional(),
  description: z.string().min(1).max(500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projectId: z.string().optional().nullable(),
  forUserId: z.string().optional().nullable(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!FINANCE_ROLES.includes(userRole)) forbidden();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as "INCOME" | "EXPENSE" | null;
  const category = searchParams.get("category");
  const projectId = searchParams.get("projectId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 50;

  const where: Record<string, unknown> = { isVoid: false };
  if (type) where.type = type;
  if (category) where.category = category;
  if (projectId) where.projectId = projectId;
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [entries, total] = await Promise.all([
    prisma.accountEntry.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        category: true,
        amountUsd: true,
        originalAmount: true,
        originalCurrency: true,
        description: true,
        date: true,
        projectId: true,
        forUserId: true,
        receiptUrl: true,
        isVoid: true,
        createdAt: true,
        project: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.accountEntry.count({ where }),
  ]);

  // Summary: income/expense totals for the current filter (un-paged)
  const summary = await prisma.accountEntry.groupBy({
    by: ["type"],
    where: { ...where },
    _sum: { amountUsd: true },
  });

  const incomeTotal = Number(summary.find((s) => s.type === "INCOME")?._sum.amountUsd ?? 0);
  const expenseTotal = Number(summary.find((s) => s.type === "EXPENSE")?._sum.amountUsd ?? 0);

  return NextResponse.json({
    data: entries,
    meta: { total, page, limit, incomeTotal, expenseTotal, profit: incomeTotal - expenseTotal },
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!FINANCE_ROLES.includes(userRole)) forbidden();

  // Support multipart (with receipt) or JSON
  const contentType = req.headers.get("content-type") ?? "";
  let body: z.infer<typeof entrySchema>;
  let receiptPath: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    body = entrySchema.parse({
      type: fd.get("type"),
      category: fd.get("category"),
      amountUsd: parseFloat(fd.get("amountUsd") as string),
      originalAmount: fd.get("originalAmount") ? parseFloat(fd.get("originalAmount") as string) : undefined,
      originalCurrency: fd.get("originalCurrency") ?? undefined,
      description: fd.get("description"),
      date: fd.get("date"),
      projectId: fd.get("projectId") ?? null,
      forUserId: fd.get("forUserId") ?? null,
    });
    const receiptFile = fd.get("receipt") as File | null;
    if (receiptFile && receiptFile.size > 0) {
      const ext = receiptFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const buffer = Buffer.from(await receiptFile.arrayBuffer());
      const path = `receipts/${userId}-${Date.now()}.${ext}` as const;
      await uploadFile(buffer, path, receiptFile.type || "image/jpeg");
      receiptPath = path;
    }
  } else {
    body = entrySchema.parse(await req.json());
  }

  const entry = await prisma.accountEntry.create({
    data: {
      type: body.type,
      category: body.category,
      amountUsd: body.amountUsd,
      originalAmount: body.originalAmount ?? null,
      originalCurrency: body.originalCurrency ?? null,
      description: body.description,
      date: new Date(body.date),
      projectId: body.projectId ?? null,
      forUserId: body.forUserId ?? null,
      receiptUrl: receiptPath,
      createdById: userId,
    },
    select: {
      id: true,
      type: true,
      category: true,
      amountUsd: true,
      description: true,
      date: true,
      createdAt: true,
    },
  });

  await logAction(userId, "ACCOUNT_ENTRY_CREATED", "AccountEntry", entry.id, {
    type: body.type,
    category: body.category,
    amountUsd: body.amountUsd,
  });

  return NextResponse.json({ data: entry }, { status: 201 });
});

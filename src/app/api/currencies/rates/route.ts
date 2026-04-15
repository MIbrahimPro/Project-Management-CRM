import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

  // Get the most recent rate record
  const latest = await prisma.currencyRate.findFirst({
    orderBy: { fetchedAt: "desc" },
    select: { rates: true, fetchedAt: true },
  });

  if (!latest) {
    // Return identity rates if none fetched yet
    return NextResponse.json({
      data: {
        rates: { USD: 1, PKR: 1, AUD: 1, GBP: 1, EUR: 1, CAD: 1, AED: 1 },
        fetchedAt: null,
      },
    });
  }

  const rates = JSON.parse(latest.rates) as Record<string, number>;
  // Always include USD base
  rates["USD"] = 1;

  return NextResponse.json({ data: { rates, fetchedAt: latest.fetchedAt } });
});

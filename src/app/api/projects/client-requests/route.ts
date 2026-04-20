import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const role = req.headers.get("x-user-role") ?? "";
  if (!["ADMIN", "PROJECT_MANAGER"].includes(role)) forbidden();

  const requests = await prisma.clientProjectRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  // Batch-fetch all unique client users (avoids N+1)
  const clientIds = Array.from(new Set(requests.map((r) => r.clientId)));
  const clients = await prisma.user.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, name: true, profilePicUrl: true },
  });
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

  const withClients = requests.map((r) => ({
    ...r,
    client: clientMap[r.clientId] ?? null,
  }));

  return NextResponse.json({ data: withClients });
});

import { NextRequest, NextResponse } from "next/server";
import { apiHandler, forbidden } from "@/lib/api/api-handler";
import { prisma } from "@/lib/db/prisma";
import { getSignedUrl } from "@/lib/storage/supabase-storage";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requestId = ctx?.params?.id;
  if (!requestId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get the request
  const request = await prisma.clientProjectRequest.findUnique({
    where: { id: requestId },
  });

  if (!request || !request.pdfUrl) {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  }

  // Clients can only access their own requests
  // Admins and managers can access all
  if (role === "CLIENT" && request.clientId !== userId) {
    forbidden();
  }

  // Generate signed URL for viewing
  const signedUrl = await getSignedUrl(request.pdfUrl, 3600); // 1 hour expiry

  return NextResponse.json({ data: { url: signedUrl } });
});

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { getSignedUrl } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profilePicUrl: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  if (!user.profilePicUrl) {
    return NextResponse.json({ data: { profilePicUrl: null } });
  }

  if (!user.profilePicUrl.startsWith("profile-pics/")) {
    return NextResponse.json({ data: { profilePicUrl: user.profilePicUrl } });
  }

  const signedUrl = await getSignedUrl(user.profilePicUrl, 3600);
  return NextResponse.json({ data: { profilePicUrl: signedUrl } });
});

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiHandler, forbidden } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

// Returns the current user's access token for use with HocuspocusProvider.
// This is safe because the request is authenticated (middleware already validated).
export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  void userId;

  const cookieStore = cookies();
  const token = cookieStore.get("access_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  return NextResponse.json({ token });
});

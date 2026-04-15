import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPushNotification } from "@/lib/push";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

function superAdminOnly(req: NextRequest) {
  if (req.headers.get("x-user-role") !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

const bodySchema = z.object({
  userId: z.string(),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
});

// POST /api/super-admin/push-test — send a test push notification to any user
export async function POST(req: NextRequest) {
  const guard = superAdminOnly(req);
  if (guard) return guard;
  const adminId = req.headers.get("x-user-id")!;

  const body = bodySchema.parse(await req.json());

  await sendPushNotification(body.userId, {
    title: body.title,
    body: body.body,
    url: "/dashboard",
  });

  await logAction(adminId, "PUSH_TEST", "User", body.userId, { title: body.title });

  return NextResponse.json({ data: { sent: true } });
}

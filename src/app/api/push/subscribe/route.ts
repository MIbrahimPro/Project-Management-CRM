import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SubscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const { subscription } = SubscriptionSchema.parse(await req.json());

  await prisma.user.update({
    where: { id: userId },
    data: { pushSubscription: JSON.stringify(subscription) },
  });

  return NextResponse.json({ success: true });
});

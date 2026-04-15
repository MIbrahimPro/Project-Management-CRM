import webPush from "web-push";
import { prisma } from "./prisma";

const vapidEmail = process.env.VAPID_EMAIL;
const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (vapidEmail && vapidPublic && vapidPrivate) {
  webPush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);
} else {
  console.warn("[Push] VAPID keys not configured — push notifications disabled");
}

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (!vapidEmail || !vapidPublic || !vapidPrivate) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushSubscription: true },
  });
  if (!user?.pushSubscription) return;

  try {
    const subscription = JSON.parse(user.pushSubscription);
    await webPush.sendNotification(subscription, JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/dashboard",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    }));
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && 
        (error.statusCode === 410 || error.statusCode === 404)) {
      await prisma.user.update({
        where: { id: userId },
        data: { pushSubscription: null },
      });
    }
    console.error("[Push Error]", error);
  }
}

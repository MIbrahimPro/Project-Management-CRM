import { prisma } from "./prisma";
import { sendPushNotification } from "./push";
import { NotificationType } from "@prisma/client";

export async function sendNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  linkUrl?: string
) {
  const prefs = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (prefs) {
    const shouldSkip = (
      (type === "CHAT_MESSAGE" && !prefs.chatInWorkHours && !prefs.chatOutWorkHours) ||
      (type === "TASK_ASSIGNED" && !prefs.taskAssigned) ||
      (type === "MEETING_SCHEDULED" && !prefs.meetingScheduled)
    );
    if (shouldSkip) return;
  }

  const notification = await prisma.notification.create({
    data: { userId, type, title, body, linkUrl },
  });

  if (global.io) {
    global.io.of("/notifications").to(`user:${userId}`).emit("new_notification", notification);
    global.io.of("/notifications").to(`user:${userId}`).emit("has_unread", true);
  }

  try {
    await sendPushNotification(userId, { title, body, url: linkUrl });
  } catch (err) {
    console.error("[Notify] Push notification failed (non-fatal):", err);
  }
}

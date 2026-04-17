import { prisma } from "./prisma";

/**
 * Handles auto check-in and 8h notification logic for a user.
 * Called when a user becomes active (presence heartbeat or connection).
 */
export async function checkAutoCheckIn(userId: string) {
  // 1. Is it Sunday?
  const now = new Date();
  const pktOffset = 5 * 60 * 60 * 1000;
  const pktNow = new Date(now.getTime() + pktOffset);
  if (pktNow.getDay() === 0) return;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // 2. Get user work hours
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { workHoursStart: true, role: true, isActive: true }
  });

  if (!user || !user.isActive || !user.workHoursStart) return;
  if (["SUPER_ADMIN", "CLIENT"].includes(user.role)) return;

  // 3. Already checked in?
  const existing = await prisma.checkIn.findUnique({
    where: { userId_date: { userId, date: today } }
  });
  if (existing) {
    // Already checked in. Handle 8h notification if not done.
    if (!existing.notified8h && !existing.checkedOutAt) {
      const hoursWorking = (now.getTime() - existing.checkedInAt.getTime()) / 3600000;
      if (hoursWorking >= 8) {
        await prisma.checkIn.update({
          where: { id: existing.id },
          data: { notified8h: true }
        });
        
        const { sendNotification } = await import("./notify");
        await sendNotification(
          userId,
          "GENERAL",
          "Shift Complete",
          "You've completed 8 hours of work! Would you like to check out or work overtime?",
          "/attendance"
        );

        // Socket emit for the popup
        if (global.io) {
          global.io.of("/notifications").to(`user:${userId}`).emit("shift_complete", {
            checkInId: existing.id,
            title: "Shift Complete",
            body: "You've completed 8 hours. What would you like to do?"
          });
        }
      }
    }
    return;
  }

  // 4. Determine if we should auto-check-in (Chunk 13.4, 13.5)
  const [h, m] = user.workHoursStart.split(":").map(Number);
  const shiftStart = new Date(now);
  shiftStart.setHours(h!, m!, 0, 0);

  // Buffer: 1 hour before start
  const oneHourBefore = new Date(shiftStart.getTime() - 60 * 60 * 1000);
  
  if (now >= oneHourBefore) {
    // Within or after shift start
    const minutesLate = (now.getTime() - shiftStart.getTime()) / 60000;
    
    let status: "PRESENT" | "LATE" | "VERY_LATE" = "PRESENT";
    let actualCheckInAt = now;

    if (minutesLate <= 60 && minutesLate >= -60) {
      // Within 1h of start -> mark as exactly shift start (Chunk 13.4)
      status = "PRESENT";
      actualCheckInAt = shiftStart;
    } else if (minutesLate > 60) {
      // Late (Chunk 13.5)
      status = minutesLate > 240 ? "VERY_LATE" : "LATE";
    }

    const checkIn = await prisma.checkIn.create({
      data: {
        userId,
        date: today,
        checkedInAt: actualCheckInAt,
        notified8h: false
      }
    });

    await prisma.attendance.upsert({
      where: { userId_date: { userId, date: today } },
      update: { status },
      create: { userId, date: today, status }
    });

    console.log(`[AutoCheckIn] User ${userId} checked in as ${status} for ${today.toDateString()}`);
  }
}

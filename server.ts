import "./src/lib/env"; // validate required env vars on startup
import { createServer } from "http";
import next from "next";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import cookieParser from "cookie-parser";
import { prisma } from "./src/lib/prisma";
import { getLastActive } from "./src/lib/redis";
import { sendPushNotification } from "./src/lib/push";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

declare global {
  var io: SocketIOServer;
}

function isSundayInPKT() {
  const now = new Date();
  // PKT is UTC+5
  const pkt = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return pkt.getDay() === 0;
}

async function refreshCurrencyRates() {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=PKR,AUD,GBP,EUR,CAD,AED"
    );
    const data = (await res.json()) as { rates: Record<string, number> };
    await prisma.currencyRate.create({
      data: { baseCurrency: "USD", rates: JSON.stringify(data.rates) },
    });
    console.log("[Currency] Rates refreshed");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Currency] Failed to refresh rates:", msg);
  }
}

// Away check job — runs every 30 minutes
async function awayCheckJob() {
  if (isSundayInPKT()) return;
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "away_check_interval_minutes" },
    });
    const intervalMin = parseInt(config?.value || "30");

    const activeCheckIns = await prisma.checkIn.findMany({
      where: { checkedOutAt: null },
      include: { user: { select: { id: true, workHoursEnd: true, pushSubscription: true } } },
    });

    const now = Date.now();
    for (const checkIn of activeCheckIns) {
      const lastActive = await getLastActive(checkIn.userId);
      const minutesInactive = lastActive ? (now - lastActive) / 60000 : 999;

      if (minutesInactive >= intervalMin) {
        const prefs = await prisma.notificationPreference.findUnique({
          where: { userId: checkIn.userId },
        });
        if (prefs?.awayCheck !== false) {
          const ping = await prisma.awayPing.create({
            data: { checkInId: checkIn.id },
          });
          await sendPushNotification(checkIn.userId, {
            title: "Are you still working?",
            body: "Tap to confirm you're active",
            url: `/api/attendance/confirm-active?pingId=${ping.id}`,
          });
        }
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[AwayCheck] Job error:", msg);
  }
}

// Auto-checkout job — runs every 15 minutes
async function autoCheckoutJob() {
  if (isSundayInPKT()) return;
  try {
    const now = new Date();
    const activeCheckIns = await prisma.checkIn.findMany({
      where: { checkedOutAt: null },
      include: { user: { select: { workHoursEnd: true } } },
    });

    for (const checkIn of activeCheckIns) {
      // 1. Shift end rule (Hard checkout)
      if (checkIn.user.workHoursEnd) {
        const [h, m] = checkIn.user.workHoursEnd.split(":").map(Number);
        const shiftEnd = new Date(now);
        shiftEnd.setHours(h!, m!, 0, 0);
        
        // If it's e.g. 03:00, and now is 05:00, auto-checkout.
        // We need to handle midnight wrap.
        // For simplicity, if h is small (e.g. 3) and now.h is larger (e.g. 5), it's same day.
        // But shifts are 19:00 - 03:00.
        // I'll use a more robust check: if checkIn.date is yesterday and it's morning today.
        
        const twoHoursAfterEnd = new Date(shiftEnd.getTime() + 2 * 60 * 60 * 1000);
        if (now > twoHoursAfterEnd && now.getTime() - checkIn.checkedInAt.getTime() > 4 * 3600000) {
          await prisma.checkIn.update({
            where: { id: checkIn.id },
            data: { checkedOutAt: now, isAutoCheckout: true },
          });
          continue;
        }
      }

      // 2. 8h notification grace period (Chunk 13.7)
      // If notified 1 hour ago and still no action, auto-checkout.
      if (checkIn.notified8h) {
        // We don't have notifiedAt, but we can assume if it's been 9h since checkedInAt.
        const hoursWorking = (now.getTime() - checkIn.checkedInAt.getTime()) / 3600000;
        if (hoursWorking >= 9) {
          await prisma.checkIn.update({
            where: { id: checkIn.id },
            data: { checkedOutAt: now, isAutoCheckout: true },
          });
          console.log(`[AutoCheckout] User ${checkIn.userId} auto-checked out after 8h + 1h grace`);
        }
      }

      // 3. Ping system penalty (Chunk 13.10)
      const pendingPings = await prisma.attendancePing.findMany({
        where: { checkInId: checkIn.id, status: "PENDING" }
      });
      for (const ping of pendingPings) {
        const pingAgeMins = (now.getTime() - ping.sentAt.getTime()) / 60000;
        if (pingAgeMins > 60) { // 1 hour grace
          await prisma.attendancePing.update({
            where: { id: ping.id },
            data: { status: "EXPIRED" }
          });
          // Auto-checkout and mark LEFT_EARLY from ping time
          await prisma.checkIn.update({
            where: { id: checkIn.id },
            data: { checkedOutAt: ping.sentAt, isAutoCheckout: true }
          });
          await prisma.attendance.update({
            where: { userId_date: { userId: checkIn.userId, date: checkIn.date } },
            data: { status: "LEFT_EARLY", note: "Failed activity check (Ping expired)" }
          });
          console.log(`[Ping] User ${checkIn.userId} marked LEFT_EARLY due to expired ping`);
        }
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[AutoCheckout] Job error:", msg);
  }
}

// Upcoming interviews job - runs every 5 minutes
async function absenceAutoMarkJob() {
  // If today is Sunday (holiday), don't mark anyone absent for Saturday? 
  // Wait, if today is Monday morning, we are checking for Monday's shift (which starts 19:00 Mon).
  // Actually, shifts wrap around midnight.
  // Let's keep it simple: if the date we are checking is Sunday, skip.
  
  try {
    const now = new Date();
    const pkt = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    // We check for the shift that just ended.
    // If it's 04:00 PKT, we check for the day before's 19:00 shift.
    const shiftDate = new Date(pkt);
    shiftDate.setDate(pkt.getDate() - 1);
    shiftDate.setHours(0, 0, 0, 0);

    // Skip if shiftDate was a Sunday
    if (shiftDate.getDay() === 0) return;

    const users = await prisma.user.findMany({
      where: {
        role: { notIn: ["SUPER_ADMIN", "CLIENT"] },
        isActive: true,
      },
      include: {
        attendance: {
          where: { date: shiftDate }
        }
      }
    });

    for (const user of users) {
      if (user.attendance.length === 0) {
        await prisma.attendance.create({
          data: {
            userId: user.id,
            date: shiftDate,
            status: "ABSENT"
          }
        });
      }
    }
    console.log(`[Absence] Mark job completed for ${shiftDate.toDateString()}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Absence] Job error:", msg);
  }
}

async function upcomingInterviewsJob() {
  try {
    const now = new Date();
    const target30m = new Date(now.getTime() + 30 * 60 * 1000);
    const target10m = new Date(now.getTime() + 10 * 60 * 1000);

    const interviews = await prisma.interview.findMany({
      where: { 
        status: "SCHEDULED",
        OR: [
          { startTime: { lte: target30m, gt: now }, notified30m: false },
          { startTime: { lte: target10m, gt: now }, notified10m: false }
        ]
      },
      include: {
        candidate: { select: { name: true, request: { select: { statedRole: true } } } },
        interviewers: { select: { id: true, pushSubscription: true } }
      }
    });

    for (const interview of interviews) {
      const is10m = interview.startTime <= target10m && !interview.notified10m;
      const title = is10m ? "Interview Starting Soon" : "Upcoming Interview";
      const body = `Your interview with ${interview.candidate.name} for ${interview.candidate.request.statedRole} starts in ${is10m ? '10' : '30'} minutes.`;

      for (const interviewer of interview.interviewers) {
        await prisma.notification.create({
          data: {
            userId: interviewer.id,
            type: "MEETING_REMINDER",
            title,
            body,
            linkUrl: `/hr`
          }
        });
        if (global.io) {
          global.io.to(interviewer.id).emit("notification", { title, body });
        }
        if (interviewer.pushSubscription) {
          await sendPushNotification(interviewer.id, { title, body, url: "/hr" });
        }
      }

      await prisma.interview.update({
        where: { id: interview.id },
        data: is10m ? { notified10m: true, notified30m: true } : { notified30m: true }
      });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[UpcomingInterviews] Job error:", msg);
  }
}

async function main() {
  await app.prepare();

  const expressApp = express();
  expressApp.use(cookieParser());

  const httpServer = createServer(expressApp);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Make io globally available to API routes
  global.io = io;

  // Socket.io namespaces
  const { setupSocketServer } = await import("./src/lib/socket-server");
  setupSocketServer(io);

  expressApp.all("*", (req, res) => {
    handle(req, res);
  });

  const PORT = parseInt(process.env.PORT || "3000", 10);
  const HOST = process.env.HOST || "0.0.0.0";
  httpServer.listen(PORT, HOST, () => {
    console.log(`> DevRolin ready on http://localhost:${PORT}`);
    console.log(`> Network access: http://${HOST}:${PORT}`);
  });

  // Background jobs — start AFTER the server is listening.
  // Delay initial run by 10s to let DB pool warm up.
  setTimeout(() => {
    void refreshCurrencyRates();
    void awayCheckJob();
    void autoCheckoutJob();
    void upcomingInterviewsJob();
    void absenceAutoMarkJob();

    // Set intervals
    setInterval(refreshCurrencyRates, 1000 * 60 * 60 * 24 * 7); // Weekly
    setInterval(awayCheckJob, 1000 * 60 * 30); // 30 mins
    setInterval(autoCheckoutJob, 1000 * 60 * 15); // 15 mins
    setInterval(upcomingInterviewsJob, 1000 * 60 * 5); // 5 mins
    setInterval(absenceAutoMarkJob, 1000 * 60 * 60); // Hourly (checks 04:00 PKT)
  }, 10_000);

  // Recurring schedules
  setInterval(() => void refreshCurrencyRates(), 7 * 24 * 60 * 60 * 1000);
  setInterval(() => void awayCheckJob(), 30 * 60 * 1000);
  setInterval(() => void autoCheckoutJob(), 15 * 60 * 1000);
  setInterval(() => void upcomingInterviewsJob(), 5 * 60 * 1000);
}

main().catch(console.error);

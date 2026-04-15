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
  try {
    const now = new Date();
    const activeCheckIns = await prisma.checkIn.findMany({
      where: { checkedOutAt: null },
      include: { user: { select: { workHoursEnd: true } } },
    });

    for (const checkIn of activeCheckIns) {
      if (!checkIn.user.workHoursEnd) continue;
      const [h, m] = checkIn.user.workHoursEnd.split(":").map(Number);
      const shiftEnd = new Date();
      shiftEnd.setHours(h!, m!, 0, 0);
      const twoHoursAfterEnd = new Date(shiftEnd.getTime() + 2 * 60 * 60 * 1000);

      if (now > twoHoursAfterEnd) {
        await prisma.checkIn.update({
          where: { id: checkIn.id },
          data: { checkedOutAt: now, isAutoCheckout: true },
        });
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[AutoCheckout] Job error:", msg);
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
  }, 10_000);

  // Recurring schedules
  setInterval(() => void refreshCurrencyRates(), 7 * 24 * 60 * 60 * 1000);
  setInterval(() => void awayCheckJob(), 30 * 60 * 1000);
  setInterval(() => void autoCheckoutJob(), 15 * 60 * 1000);
}

main().catch(console.error);

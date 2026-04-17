import IORedis from "ioredis";

// Prefer 127.0.0.1 on Windows so we resolve IPv4 consistently (WSL / Docker port forwards).
const defaultRedisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let lastRedisErrorLogAt = 0;
const REDIS_ERROR_LOG_INTERVAL_MS = 30_000;

const redis = new IORedis(defaultRedisUrl, {
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  connectTimeout: 10_000,
  commandTimeout: 15_000,
  lazyConnect: false,
  enableReadyCheck: true,
  keepAlive: 10_000,
  retryStrategy: (times) => {
    if (times > 15) return null;
    return Math.min(times * 200, 4_000);
  },
  reconnectOnError: (err) => {
    const m = err.message;
    return (
      m.includes("READONLY") ||
      m.includes("ECONNRESET") ||
      m.includes("ETIMEDOUT") ||
      m.includes("ECONNREFUSED") ||
      m.includes("Connection is closed") ||
      m.includes("Command timed out")
    );
  },
});

redis.on("error", (err) => {
  const message = err instanceof Error ? err.message : String(err);
  const now = Date.now();
  if (now - lastRedisErrorLogAt >= REDIS_ERROR_LOG_INTERVAL_MS) {
    lastRedisErrorLogAt = now;
    console.error("[Redis]", message);
  }
});

export { redis };

// ---- Session Management ----
export async function setSession(deviceId: string, data: Record<string, string>, ttlSeconds: number) {
  try {
    await redis.setex(`session:${deviceId}`, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    console.error("[Redis Session] setSession failed:", err);
  }
}
export async function getSession(deviceId: string) {
  try {
    const raw = await redis.get(`session:${deviceId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("[Redis Session] getSession failed:", err);
    return null;
  }
}
export async function deleteSession(deviceId: string) {
  try {
    await redis.del(`session:${deviceId}`);
  } catch (err) {
    console.error("[Redis Session] deleteSession failed:", err);
  }
}
export async function deleteAllUserSessions(userId: string, deviceIds: string[]) {
  try {
    const pipeline = redis.pipeline();
    for (const id of deviceIds) pipeline.del(`session:${id}`);
    await pipeline.exec();
  } catch (err) {
    console.error("[Redis Session] deleteAllUserSessions failed:", err);
  }
}

// ---- Token Blacklist ----
export async function blacklistToken(tokenHash: string, userId: string, gracePeriodMs: number, expiresInMs: number) {
  try {
    const data = JSON.stringify({ userId, graceUntil: Date.now() + gracePeriodMs, reusedOnce: false });
    await redis.setex(`blacklist:${tokenHash}`, Math.ceil(expiresInMs / 1000), data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Redis Blacklist] Failed to write blacklist entry:", message);
  }
}
export async function getBlacklistEntry(tokenHash: string) {
  try {
    const raw = await redis.get(`blacklist:${tokenHash}`);
    return raw ? JSON.parse(raw) as { userId: string; graceUntil: number; reusedOnce: boolean } : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Redis Blacklist] Failed to read blacklist entry:", message);
    return null;
  }
}
export async function markTokenReused(tokenHash: string) {
  try {
    const entry = await getBlacklistEntry(tokenHash);
    if (!entry) return;
    const ttl = await redis.ttl(`blacklist:${tokenHash}`);
    if (ttl <= 0) return;
    await redis.setex(`blacklist:${tokenHash}`, ttl, JSON.stringify({ ...entry, reusedOnce: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Redis Blacklist] Failed to mark token reused:", message);
  }
}

// ---- Presence (best-effort; never throws — Socket.io must not spam logs) ----
export async function setPresence(userId: string, status: "online" | "away" | "offline") {
  try {
    if (status === "offline") {
      await redis.del(`presence:${userId}`);
    } else {
      await redis.setex(`presence:${userId}`, 65, status);
    }
  } catch {
    /* ignore */
  }
}
export async function getPresence(userId: string): Promise<"online" | "away" | "offline"> {
  try {
    const val = await redis.get(`presence:${userId}`);
    return (val as "online" | "away") || "offline";
  } catch {
    return "offline";
  }
}
export async function getAllOnlineUsers(): Promise<Record<string, "online" | "away">> {
  try {
    const keys = await redis.keys("presence:*");
    if (keys.length === 0) return {};
    const values = await redis.mget(keys);
    const map: Record<string, "online" | "away"> = {};
    keys.forEach((key, i) => {
      const userId = key.split(":")[1];
      const status = values[i] as "online" | "away";
      if (status) map[userId] = status;
    });
    return map;
  } catch {
    return {};
  }
}
export async function updateLastActive(userId: string) {
  try {
    await redis.setex(`last_active:${userId}`, 3600, Date.now().toString());
  } catch {
    /* ignore */
  }
}
export async function getLastActive(userId: string): Promise<number | null> {
  try {
    const val = await redis.get(`last_active:${userId}`);
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

// ---- Typing Indicators ----
export async function setTyping(roomId: string, userId: string) {
  try {
    await redis.setex(`typing:${roomId}:${userId}`, 4, "1");
  } catch {
    /* ignore */
  }
}
export async function clearTyping(roomId: string, userId: string) {
  try {
    await redis.del(`typing:${roomId}:${userId}`);
  } catch {
    /* ignore */
  }
}
export async function getTypingUsers(roomId: string): Promise<string[]> {
  try {
    const keys = await redis.keys(`typing:${roomId}:*`);
    return keys.map((k) => k.split(":")[2]).filter(Boolean);
  } catch {
    return [];
  }
}

// ---- Rate Limiting (sliding window) ----
export async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  try {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(`rate:${key}`, 0, windowStart);
    pipeline.zadd(`rate:${key}`, now, `${now}-${Math.random()}`);
    pipeline.zcard(`rate:${key}`);
    pipeline.expire(`rate:${key}`, windowSeconds);
    const results = await pipeline.exec();
    const countRaw = results?.[2]?.[1];
    const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
    if (!Number.isFinite(count)) {
      return true;
    }
    return count <= maxRequests;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[RateLimit] Redis unavailable, allowing request:", message);
    return true;
  }
}

// ---- OTP Attempt Tracking ----
export async function incrementOtpAttempts(userId: string): Promise<number> {
  try {
    const key = `otp_attempts:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 900);
    return count;
  } catch (err) {
    console.error("[Redis OTP] incrementOtpAttempts failed:", err);
    return 0; // Fail open
  }
}
export async function blockOtpUser(userId: string, blockMinutes: number) {
  try {
    await redis.setex(`otp_blocked:${userId}`, blockMinutes * 60, "1");
  } catch (err) {
    console.error("[Redis OTP] blockOtpUser failed:", err);
  }
}
export async function isOtpBlocked(userId: string): Promise<boolean> {
  try {
    return !!(await redis.get(`otp_blocked:${userId}`));
  } catch (err) {
    console.error("[Redis OTP] isOtpBlocked failed:", err);
    return false; // Fail open
  }
}
export async function clearOtpAttempts(userId: string) {
  try {
    await redis.del(`otp_attempts:${userId}`);
  } catch (err) {
    console.error("[Redis OTP] clearOtpAttempts failed:", err);
  }
}

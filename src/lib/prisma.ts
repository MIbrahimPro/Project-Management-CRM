import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Supabase poolers (session mode especially) enforce a low max client count.
 * Prisma's default pool can exceed that when multiple PrismaClient instances exist.
 * Append a conservative connection_limit when missing.
 */
function withPooledConnectionLimit(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    const host = u.hostname;
    const looksLikeSupabase =
      host.includes("supabase.co") || host.includes("supabase.com") || host.includes("pooler");
    if (looksLikeSupabase) {
      const currentLimit = u.searchParams.get("connection_limit");
      const parsedLimit = currentLimit ? Number(currentLimit) : NaN;
      const safeLimit = Number.isFinite(parsedLimit) ? Math.min(parsedLimit, 5) : 5;
      u.searchParams.set("connection_limit", `${safeLimit}`);
      if (!u.searchParams.has("pool_timeout")) {
        u.searchParams.set("pool_timeout", "20");
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

const pooledDatabaseUrl = withPooledConnectionLimit(process.env.DATABASE_URL ?? "");

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: pooledDatabaseUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;

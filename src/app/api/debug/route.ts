import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export const GET = async () => {
  const results: Record<string, string> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    results.database = "OK";
  } catch (e) {
    results.database = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    await redis.ping();
    results.redis = "OK";
  } catch (e) {
    results.redis = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  results.env_db = process.env.DATABASE_URL ? "SET" : "MISSING";
  results.env_redis = process.env.REDIS_URL ? "SET" : "MISSING";
  results.env_access_secret = process.env.ACCESS_TOKEN_SECRET ? "SET" : "MISSING";
  results.env_refresh_secret = process.env.REFRESH_TOKEN_SECRET ? "SET" : "MISSING";
  results.env_ai = process.env.GROQ_API_KEY ? "SET" : "MISSING";

  return NextResponse.json(results);
};

import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/api-handler";
import { getAllOnlineUsers } from "@/lib/db/redis";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const onlineUsers = await getAllOnlineUsers();
  return NextResponse.json({ data: onlineUsers });
});

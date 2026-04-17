import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getClientIp } from "@/lib/request-ip";
import { requireUserManagement } from "@/lib/admin-user-management";

export const dynamic = "force-dynamic";

const CreateGroupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  userIds: z.array(z.string()).min(1, "At least one member is required"),
  adminsOnlyPosting: z.boolean().default(false),
  avatarUrl: z.string().nullable().optional(),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") ?? forbidden();
  const role = req.headers.get("x-user-role") ?? "";

  // Require Manager or Admin to create a custom group
  if (!["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(role)) {
    forbidden();
  }

  const body = CreateGroupSchema.parse(await req.json());

  // Ensure creator is in the members list
  const memberIds = new Set(body.userIds);
  memberIds.add(userId);

  // Validate users to ensure no CLIENT or SUPER_ADMIN
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(memberIds) } },
    select: { id: true, role: true },
  });
  if (users.some(u => u.role === "CLIENT" || u.role === "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Cannot add CLIENT or SUPER_ADMIN to groups" }, { status: 400 });
  }

  const room = await prisma.chatRoom.create({
    data: {
      type: "custom_group",
      name: body.name,
      avatarUrl: body.avatarUrl,
      createdById: userId,
      adminsOnlyPosting: body.adminsOnlyPosting,
      members: {
        create: Array.from(memberIds).map((id) => ({
          userId: id,
          isGroupAdmin: id === userId,
        })),
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, profilePicUrl: true, role: true, clientColor: true },
          },
        },
      },
    },
  });

  await logAction(
    userId,
    "CHAT_ROOM_CREATE",
    "ChatRoom",
    room.id,
    { type: "custom_group", name: room.name, memberCount: memberIds.size },
    getClientIp(req)
  );

  return NextResponse.json({ data: room });
});

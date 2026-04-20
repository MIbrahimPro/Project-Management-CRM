import { Prisma, PrismaClient, UserRole } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

// Roles auto-added to the TEAM room (everyone except client).
// SUPER_ADMIN is a hidden/technical role — never auto-added to any room.
const TEAM_MANAGER_ROLES: UserRole[] = ["ADMIN", "PROJECT_MANAGER"];

// Roles allowed in the CLIENT room (client + managers only — no devs, designers, HR, etc.)
const CLIENT_ROOM_ROLES: UserRole[] = ["ADMIN", "PROJECT_MANAGER"];

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

async function getProjectParticipants(db: DbClient, projectId: string) {
  const [project, teamManagers, clientRoomManagers] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        createdById: true,
        members: { select: { userId: true, user: { select: { role: true } } } },
      },
    }),
    // Managers for the team room
    db.user.findMany({
      where: { role: { in: TEAM_MANAGER_ROLES }, isActive: true },
      select: { id: true },
    }),
    // Managers for the client room (strictly ADMIN + PROJECT_MANAGER)
    db.user.findMany({
      where: { role: { in: CLIENT_ROOM_ROLES }, isActive: true },
      select: { id: true },
    }),
  ]);

  if (!project) return null;

  const teamManagerIds = teamManagers.map((m) => m.id);
  const clientManagerIds = clientRoomManagers.map((m) => m.id);

  // Team room: all project members + managers, minus the client, minus SUPER_ADMIN
  const baseTeamIds = uniqueIds([
    project.createdById,
    ...project.members
      .filter((m) => m.user.role !== "SUPER_ADMIN")
      .map((m) => m.userId),
    ...teamManagerIds,
  ]);
  const teamRoomUserIds = baseTeamIds.filter((id) => id !== project.clientId);

  // Client room: ONLY client + ADMIN + PROJECT_MANAGER. No devs, designers, HR, etc.
  const clientRoomUserIds = uniqueIds([project.clientId, ...clientManagerIds]);

  return {
    teamRoomUserIds,
    clientRoomUserIds,
  };
}

async function syncRoomMembers(db: DbClient, roomId: string, desiredUserIds: string[]) {
  await db.chatRoomMember.deleteMany({
    where: {
      roomId,
      userId: { notIn: desiredUserIds.length > 0 ? desiredUserIds : ["__none__"] },
    },
  });

  if (desiredUserIds.length > 0) {
    await db.chatRoomMember.createMany({
      data: desiredUserIds.map((userId) => ({ roomId, userId })),
      skipDuplicates: true,
    });
  }
}

/**
 * Ensures the two required project rooms exist and memberships are synchronized:
 * - project_team_group (everyone except client)
 * - project_client_manager (client + managers/admins)
 */
export async function ensureProjectChatRooms(db: DbClient, projectId: string): Promise<void> {
  const participants = await getProjectParticipants(db, projectId);
  if (!participants) return;

  const existingRooms = await db.chatRoom.findMany({
    where: { projectId, type: { in: ["project_team_group", "project_client_manager"] } },
    select: { id: true, type: true },
  });

  let teamRoomId = existingRooms.find((r) => r.type === "project_team_group")?.id;
  let clientRoomId = existingRooms.find((r) => r.type === "project_client_manager")?.id;

  if (!teamRoomId) {
    const created = await db.chatRoom.create({
      data: {
        projectId,
        type: "project_team_group",
        name: "Team Chat",
      },
      select: { id: true },
    });
    teamRoomId = created.id;
  }

  if (!clientRoomId) {
    const created = await db.chatRoom.create({
      data: {
        projectId,
        type: "project_client_manager",
        name: "Client & Managers",
      },
      select: { id: true },
    });
    clientRoomId = created.id;
  }

  await Promise.all([
    syncRoomMembers(db, teamRoomId, participants.teamRoomUserIds),
    syncRoomMembers(db, clientRoomId, participants.clientRoomUserIds),
  ]);
}


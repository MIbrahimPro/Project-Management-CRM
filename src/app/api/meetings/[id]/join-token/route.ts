import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, forbidden } from "@/lib/api-handler";
import { generateLiveKitToken, getLiveKitUrl } from "@/lib/livekit";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];
const CLIENT_INVITER_ROLES_ALLOWED = ["ADMIN", "PROJECT_MANAGER"];

function normalizeGuestName(rawName: string | null): string {
  const normalized = (rawName ?? "").trim().replace(/\s+/g, " ").slice(0, 48);
  if (normalized) return normalized;

  const GUEST_NAMES = [
    "Celestial Swift",
    "Lunar Lark",
    "Nova Nymph",
    "Stellar Sparrow",
    "Cosmic Wren",
    "Aurora Finch",
    "Meteor Moth",
    "Galactic Glider",
    "Solar Sparrow",
    "Nebula Nymph",
    "Comet Canary",
    "Orbit Owl",
    "Pulsar Pipit",
    "Eclipse Egret",
    "Starburst Swift",
    "Twilight Thrush",
    "Zenith Zephyr",
    "Horizon Heron",
    "Vega Vireo",
    "Lyra Lark",
    "Andromeda Auk",
    "Cassiopeia Chickadee",
    "Pegasus Petrel",
    "Draco Dove",
    "Phoenix Plover",
    "Cepheus Cuckoo",
    "Cygnus Crane",
    "Orion Oriole",
    "Taurus Tern",
    "Gemini Goldfinch",
    "Leo Lark",
    "Virgo Vireo",
    "Libra Larkspur",
    "Scorpius Skylark",
    "Sagittarius Siskin",
    "Capricorn Catbird",
    "Aquarius Avocet",
    "Pisces Pipit",
    "Ursa Urchin",
    "Cetus Chickadee",
    "Eridanus Egret",
    "Hydra Hummingbird",
    "Perseus Plover",
    "Hercules Heron",
    "Bootes Bunting",
    "Corvus Crane",
    "Serpens Sparrow",
    "Lyra Larkspur",
    "Vulpecula Vireo",
    "Delphinus Dove",
    "Equuleus Egret",
    "Fornax Finch",
    "Grus Goldfinch",
    "Indus Ibis",
    "Lacerta Lark",
    "Mensa Mynah",
    "Microscopium Mockingbird",
    "Norma Nuthatch",
    "Octans Oriole",
    "Pavo Pipit",
    "Pictor Plover",
    "Puppis Petrel",
    "Pyxis Pigeon",
    "Reticulum Robin",
    "Sculptor Skylark",
    "Scutum Siskin",
    "Telescopium Tern",
    "Triangulum Thrush",
    "Tucana Trogon",
    "Volans Vireo",
    "Apus Avocet",
    "Chamaeleon Chickadee",
    "Ara Auk",
    "Caelum Catbird",
    "Columba Crane",
    "Corona Crane",
    "Crater Crane",
    "Crux Cuckoo",
    "Dorado Dove",
    "Lepus Lark",
    "Lupus Larkspur",
    "Monoceros Mockingbird",
    "Musca Mynah",
    "Pavo Pipit",
    "Phoenix Plover",
    "Piscis Pipit",
    "Sagitta Sparrow",
    "Triangulum Tern",
    "Vela Vireo",
    "Virgo Vireo",
    "Volans Vireo"
  ];

  const pick = GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${pick} ${suffix}`;
}

export const GET = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  const isGuestJoin = req.nextUrl.searchParams.get("guest") === "1";

  if (!userId && !isGuestJoin) {
    return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const meetingId = ctx?.params.id;
  if (!meetingId) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      title: true,
      liveKitRoomId: true,
      endedAt: true,
      projectId: true,
      workspaceId: true,
      taskId: true,
      createdById: true,
      isClientMeeting: true,
      invitees: { select: { userId: true } },
      project: {
        select: {
          clientId: true,
          members: { select: { userId: true } },
        },
      },
      workspace: {
        select: {
          members: { select: { userId: true } },
        },
      },
      task: {
        select: {
          assignees: { select: { userId: true } },
          createdById: true,
        },
      },
      interview: {
        select: {
          interviewers: { select: { id: true } },
        },
      },
    },
  });
  if (!meeting) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  if (meeting.endedAt) {
    return NextResponse.json({ error: "Meeting has ended", code: "GONE" }, { status: 410 });
  }

  if (isGuestJoin && !userId) {
    return NextResponse.json({
      data: {
        meetingId,
        liveKitRoomId: meeting.liveKitRoomId,
        url: getLiveKitUrl(),
        token: null,
        isModerator: false,
        canInviteUsers: false,
        canInviteClients: false,
        isGuest: true,
        displayName: normalizeGuestName(req.nextUrl.searchParams.get("name")),
      },
    });
  }

  const authenticatedUserId = userId as string;

  // Access check for scoped meetings
  const isManager = MANAGER_ROLES.includes(userRole);
  if (!isManager) {
    if (meeting.project) {
      const isMember = meeting.project.members.some((m) => m.userId === authenticatedUserId);
      const isClient = userRole === "CLIENT" && meeting.project.clientId === authenticatedUserId;
      if (!isMember && !isClient) forbidden();

      // Client meetings: non-manager users must be explicitly invited OR be the project client
      if (meeting.isClientMeeting) {
        const isInvited = meeting.invitees.some((i) => i.userId === authenticatedUserId);
        if (!isInvited && !isClient) forbidden();
      }
    } else if (meeting.workspace) {
      const isMember = meeting.workspace.members.some((m) => m.userId === authenticatedUserId);
      if (!isMember) forbidden();
    } else if (meeting.task) {
      const isAssignee = meeting.task.assignees.some((m) => m.userId === authenticatedUserId);
      const isCreator = meeting.task.createdById === authenticatedUserId;
      if (!isAssignee && !isCreator) forbidden();
    } else if (meeting.interview) {
      const isInterviewer = meeting.interview.interviewers.some((u) => u.id === authenticatedUserId);
      if (!isInterviewer) forbidden();
    }
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: authenticatedUserId },
    select: { id: true, name: true, email: true },
  });
  if (!dbUser) return forbidden();

  const isCreator = meeting.task?.createdById === authenticatedUserId || meeting.interview?.interviewers.some(u => u.id === authenticatedUserId) || meeting.createdById === authenticatedUserId;
  const isModerator = MANAGER_ROLES.includes(userRole) || isCreator;

  const token = generateLiveKitToken(meeting.liveKitRoomId, {
    id: authenticatedUserId,
    name: dbUser.name,
    isModerator,
  });

  return NextResponse.json({
    data: {
      meetingId,
      title: meeting.title,
      liveKitRoomId: meeting.liveKitRoomId,
      url: getLiveKitUrl(),
      token: token ?? null,
      isModerator,
      canInviteUsers: userRole !== "CLIENT",
      canInviteClients: CLIENT_INVITER_ROLES_ALLOWED.includes(userRole),
      isGuest: false,
      displayName: null,
      email: dbUser.email,
    },
  });
});

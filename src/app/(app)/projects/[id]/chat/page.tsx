"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ChatRoom } from "@/components/chat/ChatRoom";
import toast from "react-hot-toast";

const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type StartMeetingResponse = {
  meetingId: string;
};

type ChatRoomMember = {
  userId: string;
  user: {
    id: string;
    name: string;
    profilePicUrl: string | null;
    role: string;
    clientColor: string;
  };
};

type Room = {
  id: string;
  name: string | null;
  type: string;
  unreadCount: number;
  members: ChatRoomMember[];
  messages: { content: string | null; createdAt: string; mediaType: string | null }[];
};

type CurrentUser = {
  id: string;
  name: string;
  role: string;
  clientColor: string;
  profilePicUrl?: string | null;
};

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"];

export default function ProjectChatPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";

  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileShowList, setMobileShowList] = useState(true);
  const [startingMeeting, setStartingMeeting] = useState(false);
  const [chatRefreshTick, setChatRefreshTick] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch(`/api/chat/rooms?projectId=${projectId}`).then((r) => r.json()),
      fetch("/api/users/me").then((r) => r.json()),
    ])
      .then(([roomsRes, userRes]: [{ data: Room[] }, { data: CurrentUser }]) => {
        const roomList = roomsRes.data ?? [];
        setRooms(roomList);
        setUser(userRes.data);
        if (roomList.length > 0) setSelectedRoom(roomList[0]);
      })
      .catch(() => {
        toast.error("Failed to load chat", { style: TOAST_ERROR_STYLE });
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!user) return;
    if (!MANAGER_ROLES.includes(user.role)) return;

    const managerRoomIds = new Set(
      rooms
        .filter((r) => r.type === "project_team_group" || r.type === "project_client_manager")
        .map((r) => r.id)
    );

    if (selectedRoom && managerRoomIds.has(selectedRoom.id)) return;
    const firstManagerRoom = rooms.find(
      (r) => r.type === "project_team_group" || r.type === "project_client_manager"
    );
    if (firstManagerRoom) setSelectedRoom(firstManagerRoom);
  }, [rooms, selectedRoom, user]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const isClient = user.role === "CLIENT";
  const isManager = MANAGER_ROLES.includes(user.role);
  const isInternalContributor = !isClient && !isManager;

  async function startMeeting(targetRoom?: { id: string; name: string | null }) {
    const roomForMeeting = targetRoom ?? selectedRoom;
    if (!roomForMeeting) return;
    const meetingTab = window.open("about:blank", "_blank");
    if (!meetingTab) {
      toast.error("Please allow pop-ups to open meetings", { style: TOAST_ERROR_STYLE });
      return;
    }

    setStartingMeeting(true);
    try {
      const res = await fetch("/api/meetings/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${roomForMeeting.name ?? "Project"} — Meeting`,
          chatRoomId: roomForMeeting.id,
        }),
      });
      const data = (await res.json()) as { data?: StartMeetingResponse; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to start meeting");
      if (!data.data) throw new Error("Failed to start meeting");
      setChatRefreshTick((v) => v + 1);
      meetingTab.location.href = `/meetings/${data.data.meetingId}`;
      toast.success("Meeting started. Join from the chat invite.");
    } catch (e) {
      meetingTab.close();
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setStartingMeeting(false);
    }
  }

  // CLIENT: show only the project_client_manager room as a simple full-screen chat
  if (isClient) {
    const clientRoom = rooms.find((r) => r.type === "project_client_manager");
    if (!clientRoom) {
      return (
        <div className="text-center py-16 text-base-content/50">
          No chat available yet.
        </div>
      );
    }
    return (
      <div className="h-[calc(100vh-8rem)]">
        <ChatRoom
          roomId={clientRoom.id}
          roomName="Project Manager"
          currentUser={user}
          showSenderInfo={false}
        />
      </div>
    );
  }

  // Developers/internal contributors: no sidebar, open team room directly.
  if (isInternalContributor) {
    const teamRoom = rooms.find((r) => r.type === "project_team_group");
    if (!teamRoom) {
      return (
        <div className="text-center py-16 text-base-content/50">
          No team room available yet.
        </div>
      );
    }

    return (
      <div className="h-[calc(100vh-8rem)]">
        <ChatRoom
          roomId={teamRoom.id}
          roomName="Team Chat"
          currentUser={user}
          showSenderInfo
          showMeetingButton
          onStartMeeting={() => void startMeeting({ id: teamRoom.id, name: teamRoom.name })}
          refreshTrigger={chatRefreshTick}
        />
      </div>
    );
  }

  // Internal team: room list + chat panel
  function getRoomDisplayName(room: Room): string {
    if (room.name) return room.name;
    if (room.type === "project_team_group") return "Team Chat";
    if (room.type === "project_client_manager") return "Client";
    // DM — show the other person's name
    const other = room.members.find((m) => m.userId !== user!.id);
    return other?.user.name ?? "Direct Message";
  }

  function getRoomInitial(room: Room): string {
    return getRoomDisplayName(room)[0]?.toUpperCase() ?? "#";
  }

  const managerRooms = rooms.filter(
    (r) => r.type === "project_team_group" || r.type === "project_client_manager"
  );

  return (
    <>
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-base-300">
      {/* ── Room list ── */}
      <div
        className={`w-72 border-r border-base-300 bg-base-200 flex flex-col flex-shrink-0 ${
          mobileShowList ? "flex" : "hidden md:flex"
        }`}
      >
        <div className="p-3 border-b border-base-300">
          <h3 className="font-semibold text-sm text-base-content">Project Chats</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {managerRooms.length === 0 && (
            <p className="text-center text-sm text-base-content/40 py-8">No rooms yet</p>
          )}
          {managerRooms.map((room) => (
            <button
              key={room.id}
              className={`w-full flex items-start gap-3 p-3 text-left hover:bg-base-300 transition-colors border-b border-base-300/50 ${
                selectedRoom?.id === room.id ? "bg-base-300" : ""
              }`}
              onClick={() => {
                setSelectedRoom(room);
                setMobileShowList(false);
                if (room.unreadCount > 0) {
                  setRooms((prev) =>
                    prev.map((r) => (r.id === room.id ? { ...r, unreadCount: 0 } : r)),
                  );
                }
              }}
            >
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-sm font-medium text-primary">
                {getRoomInitial(room)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-medium text-base-content truncate">
                    {getRoomDisplayName(room)}
                  </span>
                  {room.unreadCount > 0 && (
                    <span className="badge badge-primary badge-xs">
                      {room.unreadCount}
                    </span>
                  )}
                </div>
                {room.messages[0] && (
                  <p className="text-xs text-base-content/50 truncate mt-0.5">
                    {room.messages[0].content ?? room.messages[0].mediaType ?? ""}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat area ── */}
      {selectedRoom ? (
        <div
          className={`flex-1 flex flex-col min-w-0 ${
            mobileShowList ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Mobile back */}
          <div className="md:hidden flex items-center gap-2 p-2 border-b border-base-300 bg-base-200">
            <button
              className="btn btn-ghost btn-xs gap-1"
              onClick={() => setMobileShowList(true)}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          </div>
          <ChatRoom
            roomId={selectedRoom.id}
            roomName={getRoomDisplayName(selectedRoom)}
            currentUser={user}
            showSenderInfo={selectedRoom.type?.includes("group") ?? true}
            showMeetingButton={!isClient}
            onStartMeeting={!isClient ? () => void startMeeting() : undefined}
            refreshTrigger={chatRefreshTick}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-base-content/40 text-sm">
          Select a conversation
        </div>
      )}
    </div>
    </>
  );
}

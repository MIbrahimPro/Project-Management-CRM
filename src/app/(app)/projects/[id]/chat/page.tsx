"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useSocket } from "@/hooks/useSocket";
import toast from "react-hot-toast";

const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

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

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];

export default function ProjectChatPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";

  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileShowList, setMobileShowList] = useState(true);

  const { socket } = useSocket("/chat");

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

  // Real-time room list updates
  useEffect(() => {
    if (!socket || !rooms.length) return;

    const roomIds = rooms.map((r) => r.id);
    roomIds.forEach((id) => socket.emit("join_room", id));

    const onNewMessage = (msg: { roomId: string; content: string | null; mediaType: string | null; createdAt: string }) => {
      setRooms((prev) =>
        prev.map((r) => {
          if (r.id !== msg.roomId) return r;
          const isSelected = selectedRoom?.id === r.id;
          return {
            ...r,
            messages: [{ content: msg.content, createdAt: msg.createdAt, mediaType: msg.mediaType }],
            unreadCount: isSelected ? 0 : r.unreadCount + 1,
          };
        })
      );
    };

    socket.on("new_message", onNewMessage);
    return () => {
      socket.off("new_message", onNewMessage);
    };
  }, [socket, rooms.length, selectedRoom?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
          showSenderInfo
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
          roomDetails={teamRoom}
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
          {managerRooms.map((room) => {
            const visibleMembers = room.members.slice(0, 3);
            const extraCount = room.members.length > 3 ? room.members.length - 3 : 0;
            return (
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
                {/* Stacked avatars */}
                <div className="flex -space-x-2 flex-shrink-0">
                  {visibleMembers.map((m) => (
                    <div
                      key={m.userId}
                      className="ring-2 ring-base-200 rounded-full flex-shrink-0"
                      title={m.user.name}
                    >
                      <UserAvatar
                        user={{ name: m.user.name, profilePicUrl: m.user.profilePicUrl }}
                        size={32}
                      />
                    </div>
                  ))}
                  {extraCount > 0 && (
                    <div className="w-8 h-8 rounded-full bg-base-300 border-2 border-base-200 flex items-center justify-center text-xs text-base-content/50">
                      +{extraCount}
                    </div>
                  )}
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
            );
          })}
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
            showSenderInfo
            roomDetails={selectedRoom}
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

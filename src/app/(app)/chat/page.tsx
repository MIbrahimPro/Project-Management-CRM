"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Search, Video, X } from "lucide-react";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { ResizablePanel } from "@/components/ui/ResizablePanel";
import { useSocket } from "@/hooks/useSocket";
import toast from "react-hot-toast";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type ChatUser = { id: string; name: string; role: string; profilePicUrl: string | null; clientColor: string };
type Room = {
  id: string;
  name: string | null;
  type: string;
  unreadCount: number;
  members: { userId: string; user: ChatUser }[];
  messages: { content: string | null; createdAt: string; mediaType: string | null }[];
};
type SearchUser = { id: string; name: string; role: string; profilePicUrl: string | null };

interface SidebarEntry {
  kind: "room" | "user";
  id: string;
  displayName: string;
  initial: string;
  colorClass: string;
  room?: Room;
  targetUser?: SearchUser;
  unreadCount: number;
  lastMessagePreview: string;
  lastMessageTime: string;
  isGroup: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", ADMIN: "Admin", PROJECT_MANAGER: "PM",
  DEVELOPER: "Developer", DESIGNER: "Designer",
  HR: "HR", ACCOUNTANT: "Accountant", SALES: "Sales", CLIENT: "Client",
};

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"];

type StartMeetingResponse = {
  meetingId: string;
};

export default function GeneralChatPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allUsers, setAllUsers] = useState<SearchUser[]>([]);
  const [user, setUser] = useState<ChatUser | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<SidebarEntry | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileShowList, setMobileShowList] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [startingMeeting, setStartingMeeting] = useState(false);
  const [chatRefreshTick, setChatRefreshTick] = useState(0);

  const { socket, connected } = useSocket("/chat");

  useEffect(() => {
    Promise.all([
      fetch("/api/chat/rooms?scope=general").then((r) => r.json()),
      fetch("/api/users/me").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ])
      .then(([roomsRes, userRes, usersRes]: [
        { data: Room[] },
        { data: ChatUser },
        { data: SearchUser[] },
      ]) => {
        setRooms(roomsRes.data ?? []);
        setUser(userRes.data);
        setAllUsers(usersRes.data ?? []);
        const allHands = (roomsRes.data ?? []).find((r) => r.type === "general_group");
        if (allHands) {
          setActiveRoomId(allHands.id);
        }
      })
      .catch(() => toast.error("Failed to load chat", { style: TOAST_ERROR_STYLE }))
      .finally(() => setLoading(false));
  }, []);

  // Socket: live room updates
  useEffect(() => {
    if (!socket || !connected || !user) return;

    function onNewMessage(msg: { roomId: string; content: string | null; mediaType: string | null; createdAt: string; senderId: string }) {
      setRooms((prev) => {
        const existing = prev.find((r) => r.id === msg.roomId);
        if (!existing) return prev;
        const isCurrentRoom = msg.roomId === activeRoomId;
        return prev.map((r) =>
          r.id === msg.roomId
            ? {
                ...r,
                messages: [{ content: msg.content, createdAt: msg.createdAt, mediaType: msg.mediaType }],
                unreadCount: isCurrentRoom ? r.unreadCount : r.unreadCount + (msg.senderId !== user!.id ? 1 : 0),
              }
            : r,
        );
      });
    }

    socket.on("new_message", onNewMessage);
    return () => { socket.off("new_message", onNewMessage); };
  }, [socket, connected, user, activeRoomId]);

  const selectRoom = useCallback((room: Room) => {
    setActiveRoomId(room.id);
    setMobileShowList(false);
    if (room.unreadCount > 0) {
      setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, unreadCount: 0 } : r)));
    }
  }, []);

  async function openDmWith(targetUserId: string) {
    try {
      const res = await fetch("/api/chat/rooms/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = (await res.json()) as { data?: Room; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const newRoom = data.data!;
      setRooms((prev) => {
        const exists = prev.find((r) => r.id === newRoom.id);
        return exists ? prev : [newRoom, ...prev];
      });
      setActiveRoomId(newRoom.id);
      setMobileShowList(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    }
  }

  async function handleStartMeeting() {
    if (!activeRoomId || startingMeeting) return;
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
        body: JSON.stringify({ title: "Chat Meeting", chatRoomId: activeRoomId }),
      });
      const data = (await res.json()) as { data?: StartMeetingResponse; error?: string };
      if (!res.ok || !data.data) throw new Error(data.error ?? "Failed to start meeting");
      setChatRefreshTick((v) => v + 1);
      meetingTab.location.href = `/meetings/${data.data.meetingId}`;
      toast.success("Meeting started. Join from the chat invite.", { style: TOAST_STYLE });
    } catch {
      meetingTab.close();
      toast.error("Failed to start meeting", { style: TOAST_ERROR_STYLE });
    } finally {
      setStartingMeeting(false);
    }
  }

  function getRoomDisplayName(room: Room): string {
    if (room.type === "general_group") return room.name ?? "All Hands";
    if (room.type === "general_dm") {
      const other = room.members.find((m) => m.userId !== user?.id);
      return other?.user.name ?? "Direct Message";
    }
    return room.name ?? "Chat";
  }

  /** Build unified sidebar entries: groups at top, then all users (merged with existing DM rooms). */
  function buildEntries(): SidebarEntry[] {
    if (!user) return [];

    const entries: SidebarEntry[] = [];
    const usersWithRooms = new Set<string>();

    // Groups first
    for (const room of rooms) {
      if (room.type === "general_group") {
        entries.push({
          kind: "room", id: room.id,
          displayName: getRoomDisplayName(room),
          initial: (room.name ?? "A")[0].toUpperCase(),
          colorClass: "bg-primary/20 text-primary",
          room, unreadCount: room.unreadCount, isGroup: true,
          lastMessagePreview: room.messages[0]?.content ?? room.messages[0]?.mediaType ?? "",
          lastMessageTime: room.messages[0]?.createdAt ?? "",
        });
      }
    }

    // DM rooms (matched to users)
    for (const room of rooms) {
      if (room.type === "general_dm") {
        const other = room.members.find((m) => m.userId !== user.id);
        if (other) usersWithRooms.add(other.userId);
        entries.push({
          kind: "room", id: room.id,
          displayName: other?.user.name ?? "DM",
          initial: (other?.user.name ?? "?")[0].toUpperCase(),
          colorClass: "bg-base-300 text-base-content/60",
          room, targetUser: other?.user ? { id: other.user.id, name: other.user.name, role: other.user.role, profilePicUrl: other.user.profilePicUrl } : undefined,
          unreadCount: room.unreadCount, isGroup: false,
          lastMessagePreview: room.messages[0]?.content ?? room.messages[0]?.mediaType ?? "",
          lastMessageTime: room.messages[0]?.createdAt ?? "",
        });
      }
    }

    // Users without DM rooms
    for (const u of allUsers) {
      if (u.id === user.id || usersWithRooms.has(u.id)) continue;
      entries.push({
        kind: "user", id: `user-${u.id}`,
        displayName: u.name,
        initial: u.name[0]?.toUpperCase() ?? "?",
        colorClass: "bg-base-300 text-base-content/60",
        targetUser: u, unreadCount: 0, isGroup: false,
        lastMessagePreview: ROLE_LABELS[u.role] ?? u.role,
        lastMessageTime: "",
      });
    }

    return entries;
  }

  const allEntries = buildEntries();
  const query = filterQuery.toLowerCase();
  const filteredEntries = query
    ? allEntries.filter((e) => e.displayName.toLowerCase().includes(query))
    : allEntries;

  // Sort: groups first, then by last message time (rooms with messages first), then alphabetical
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (a.isGroup && !b.isGroup) return -1;
    if (!a.isGroup && b.isGroup) return 1;
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
    if (a.lastMessageTime && b.lastMessageTime) return b.lastMessageTime > a.lastMessageTime ? 1 : -1;
    if (a.lastMessageTime && !b.lastMessageTime) return -1;
    if (!a.lastMessageTime && b.lastMessageTime) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  // Find the active entry for display
  const activeEntry = allEntries.find((e) => e.kind === "room" && e.room?.id === activeRoomId);
  const isManager = user ? MANAGER_ROLES.includes(user.role) : false;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-base-300">
      {/* Room list */}
      <ResizablePanel
        defaultWidth={288}
        minWidth={200}
        maxWidth={500}
        storageKey="chat-sidebar-width"
        className={`border-r border-base-300 bg-base-200 ${
          mobileShowList ? "flex" : "hidden md:flex"
        }`}
      >
        <div className="p-3 border-b border-base-300">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              type="text"
              className="input input-bordered input-sm bg-base-100 w-full pl-9"
              placeholder="Search..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sortedEntries.map((entry) => (
            <button
              key={entry.id}
              className={`w-full flex items-start gap-3 p-3 text-left hover:bg-base-300 transition-colors border-b border-base-300/50 ${
                activeRoomId && entry.kind === "room" && entry.room?.id === activeRoomId ? "bg-base-300" : ""
              }`}
              onClick={() => {
                if (entry.kind === "room" && entry.room) {
                  selectRoom(entry.room);
                } else if (entry.kind === "user" && entry.targetUser) {
                  void openDmWith(entry.targetUser.id);
                }
              }}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${entry.colorClass}`}
              >
                {entry.initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-medium text-base-content truncate">
                    {entry.displayName}
                  </span>
                  {entry.unreadCount > 0 && (
                    <span className="badge badge-primary badge-xs">{entry.unreadCount}</span>
                  )}
                </div>
                {entry.lastMessagePreview && (
                  <p className="text-xs text-base-content/50 truncate mt-0.5">
                    {entry.lastMessagePreview}
                  </p>
                )}
              </div>
            </button>
          ))}

          {sortedEntries.length === 0 && (
            <p className="text-center text-sm text-base-content/40 py-8">
              {filterQuery ? "No results" : "No conversations yet"}
            </p>
          )}
        </div>
      </ResizablePanel>

      {/* Chat area */}
      {activeRoomId && activeEntry ? (
        <div
          className={`flex-1 flex flex-col min-w-0 ${
            mobileShowList ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="md:hidden flex items-center gap-2 p-2 border-b border-base-300 bg-base-200">
            <button
              className="btn btn-ghost btn-xs gap-1"
              onClick={() => setMobileShowList(true)}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          </div>
          <ChatRoom
            roomId={activeRoomId}
            roomName={activeEntry.displayName}
            currentUser={user}
            showSenderInfo={activeEntry.isGroup}
            showMeetingButton={isManager}
            onStartMeeting={isManager ? handleStartMeeting : undefined}
            refreshTrigger={chatRefreshTick}
          />
        </div>
      ) : (
        <div className={`flex-1 flex items-center justify-center text-base-content/40 text-sm ${mobileShowList ? "hidden md:flex" : "flex"}`}>
          Select a conversation to start chatting
        </div>
      )}
      </div>
    </>
  );
}

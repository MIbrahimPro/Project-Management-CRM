"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Search, Video, X, Plus } from "lucide-react";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { ResizablePanel } from "@/components/ui/ResizablePanel";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { AvatarStack } from "@/components/projects/AvatarStack";
import { useSocket } from "@/hooks/useSocket";
import toast from "react-hot-toast";

import { usePresence } from "@/components/layout/PresenceProvider";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type ChatUser = { id: string; name: string; role: string; profilePicUrl: string | null; clientColor: string };
type Room = {
  id: string;
  name: string | null;
  type: string;
  unreadCount: number;
  members: { userId: string; user: ChatUser; isGroupAdmin?: boolean }[];
  messages: { content: string | null; createdAt: string; mediaType: string | null }[];
  adminsOnlyPosting?: boolean;
  avatarUrl?: string | null;
  createdById?: string;
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
  avatarUrl?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", ADMIN: "Admin", PROJECT_MANAGER: "PM",
  DEVELOPER: "Developer", DESIGNER: "Designer",
  HR: "HR", ACCOUNTANT: "Accountant", SALES: "Sales", CLIENT: "Client",
};

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];

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
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [newGroupAdminsOnly, setNewGroupAdminsOnly] = useState(false);
  const [newGroupAvatarUrl, setNewGroupAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const { socket, connected } = useSocket("/chat");
  const presenceMap = usePresence();

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
        if (!existing) {
          // New room created by someone else (DM or Group) -> Refresh list
          fetch("/api/chat/rooms?scope=general")
            .then(r => r.json())
            .then(d => { if(d.data) setRooms(d.data); });
          return prev;
        }
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
    if (room.type === "custom_group") return room.name ?? "Group Chat";
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
      if (room.type === "general_group" || room.type === "custom_group") {
        entries.push({
          kind: "room", id: room.id,
          displayName: getRoomDisplayName(room),
          initial: (room.name ?? "A")[0].toUpperCase(),
          colorClass: room.type === "general_group" ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary",
          room, unreadCount: room.unreadCount, isGroup: true,
          avatarUrl: room.avatarUrl,
          lastMessagePreview: room.messages[0]?.content ?? room.messages[0]?.mediaType ?? "",
          lastMessageTime: room.messages[0]?.createdAt ?? "",
        });
      }
    }

    // DM rooms (matched to users)
    for (const room of rooms) {
      if (room.type === "general_dm") {
        const other = room.members.find((m) => m.userId !== user.id);
        if (!other) continue;
        
        // Hide client DMs from non-managers (in case old rooms exist)
        if (other.user.role === "CLIENT" && !MANAGER_ROLES.includes(user.role)) {
          continue;
        }

        // DEDUPLICATION: If we already have a DM room for this user, skip duplicates
        if (usersWithRooms.has(other.userId)) continue;
        usersWithRooms.add(other.userId);

        entries.push({
          kind: "room", id: room.id,
          displayName: other.user.name,
          initial: other.user.name[0].toUpperCase(),
          colorClass: "bg-base-300 text-base-content/60",
          room, targetUser: { id: other.user.id, name: other.user.name, role: other.user.role, profilePicUrl: other.user.profilePicUrl },
          unreadCount: room.unreadCount, isGroup: false,
          avatarUrl: other.user.profilePicUrl,
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
        avatarUrl: u.profilePicUrl,
        lastMessagePreview: ROLE_LABELS[u.role] ?? u.role,
        lastMessageTime: "",
      });
    }

    return entries;
  }

  const allEntries = buildEntries();
  // Final deduplication by ID just in case
  const uniqueEntries = Array.from(new Map(allEntries.map(e => [e.id, e])).values());

  const query = filterQuery.toLowerCase();
  const filteredEntries = query
    ? uniqueEntries.filter((e) => e.displayName.toLowerCase().includes(query))
    : uniqueEntries;

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
  const activeEntry = uniqueEntries.find((e) => e.kind === "room" && e.room?.id === activeRoomId);
  const isManager = user ? MANAGER_ROLES.includes(user.role) : false;
  const canStartMeeting = user ? user.role !== "CLIENT" : false;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!user) return null;

  async function handleCreateGroup() {
    if (!newGroupName.trim() || newGroupMembers.length === 0) {
      toast.error("Please enter a name and select at least one member", { style: TOAST_ERROR_STYLE });
      return;
    }
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/chat/rooms/custom-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName,
          userIds: newGroupMembers,
          adminsOnlyPosting: newGroupAdminsOnly,
          avatarUrl: newGroupAvatarUrl,
        }),
      });
      const data = (await res.json()) as { data?: Room; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create group");
      
      const newRoom = { ...data.data!, unreadCount: 0, messages: [] };
      setRooms((prev) => [newRoom, ...prev]);
      setActiveRoomId(newRoom.id);
      setMobileShowList(false);
      setShowCreateGroup(false);
      setNewGroupName("");
      setNewGroupMembers([]);
      setNewGroupAdminsOnly(false);
      setNewGroupAvatarUrl(null);
      toast.success("Group created", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setCreatingGroup(false);
    }
  }

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
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
              <input
                type="text"
                className="input input-bordered input-sm bg-base-100 w-full pl-9"
                placeholder="Search..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
            </div>
            {isManager && (
              <button
                className="btn btn-sm btn-circle btn-ghost"
                onClick={() => setShowCreateGroup(true)}
                title="Create Group"
              >
                <Plus className="w-4 h-4 text-primary" />
              </button>
            )}
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
              <div className="flex-shrink-0">
                {entry.isGroup && entry.room && !entry.avatarUrl ? (
                  <AvatarStack 
                    users={entry.room.members.slice(0, 3).map(m => m.user)} 
                    overflow={Math.max(0, entry.room.members.length - 3)} 
                  />
                ) : (
                  <UserAvatar 
                    user={entry.targetUser ? { name: entry.targetUser.name, profilePicUrl: entry.targetUser.profilePicUrl } : { name: entry.displayName, profilePicUrl: entry.avatarUrl }} 
                    size={32} 
                    showPresence={!entry.isGroup}
                    isOnline={entry.targetUser ? presenceMap[entry.targetUser.id] === "online" : false}
                  />
                )}
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
                {entry.lastMessagePreview ? (
                  <p className="text-xs text-base-content/50 truncate mt-0.5">
                    {entry.lastMessagePreview}
                  </p>
                ) : (
                  entry.isGroup && entry.room && (
                    <p className="text-xs text-base-content/50 truncate mt-0.5">
                      {entry.room.members.length} members 
                      <span className="text-success ml-1">
                        ({entry.room.members.filter(m => presenceMap[m.userId] === "online").length} online)
                      </span>
                    </p>
                  )
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
            showMeetingButton={canStartMeeting}
            onStartMeeting={canStartMeeting ? handleStartMeeting : undefined}
            refreshTrigger={chatRefreshTick}
            roomDetails={activeEntry.room}
          />
        </div>
      ) : (
        <div className={`flex-1 flex items-center justify-center text-base-content/40 text-sm ${mobileShowList ? "hidden md:flex" : "flex"}`}>
          Select a conversation to start chatting
        </div>
      )}
      </div>

      {showCreateGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-base-100 rounded-xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-base-300 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Create Group</h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowCreateGroup(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="flex items-center gap-4">
                <UserAvatar user={{ name: newGroupName || "New Group", profilePicUrl: newGroupAvatarUrl }} size={64} />
                <div className="flex-1">
                  <label className="btn btn-sm btn-outline">
                    {uploadingAvatar ? <span className="loading loading-spinner loading-xs" /> : "Upload Image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingAvatar(true);
                        const formData = new FormData();
                        formData.append("file", file);
                        formData.append("type", "image");
                        try {
                          const res = await fetch("/api/chat/upload", { method: "POST", body: formData });
                          const data = await res.json();
                          if (res.ok && data.data?.path) setNewGroupAvatarUrl(data.data.path);
                          else throw new Error(data.error || "Upload failed");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Upload failed");
                        } finally {
                          setUploadingAvatar(false);
                        }
                      }}
                    />
                  </label>
                  {newGroupAvatarUrl && (
                    <button className="btn btn-sm btn-ghost text-error ml-2" onClick={() => setNewGroupAvatarUrl(null)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="form-control">
                <label className="label text-xs font-semibold">Group Name</label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Marketing Team"
                  autoFocus
                />
              </div>

              <div className="form-control">
                <label className="label text-xs font-semibold">Members</label>
                <div className="border border-base-300 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {allUsers.filter(u => u.id !== user.id && u.role !== "CLIENT" && u.role !== "SUPER_ADMIN").map(u => (
                    <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-base-200 cursor-pointer border-b border-base-300 last:border-0">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={newGroupMembers.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setNewGroupMembers(prev => [...prev, u.id]);
                          else setNewGroupMembers(prev => prev.filter(id => id !== u.id));
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{u.name}</span>
                        <span className="text-xs text-base-content/60">{ROLE_LABELS[u.role] ?? u.role}</span>
                      </div>
                    </label>
                  ))}
                  {allUsers.filter(u => u.id !== user.id && u.role !== "CLIENT" && u.role !== "SUPER_ADMIN").length === 0 && (
                    <div className="p-3 text-sm text-center text-base-content/40">No other users available</div>
                  )}
                </div>
              </div>

              <div className="form-control flex-row items-center justify-between p-3 border border-base-300 rounded-lg">
                <div>
                  <span className="label-text font-semibold block">Only Admins Can Post</span>
                  <span className="text-xs text-base-content/60">Restrict posting to group admins only</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={newGroupAdminsOnly}
                  onChange={(e) => setNewGroupAdminsOnly(e.target.checked)}
                />
              </div>
            </div>
            <div className="p-4 border-t border-base-300 bg-base-200/50 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setShowCreateGroup(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCreateGroup}
                disabled={creatingGroup || !newGroupName.trim() || newGroupMembers.length === 0}
              >
                {creatingGroup ? <span className="loading loading-spinner loading-sm" /> : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

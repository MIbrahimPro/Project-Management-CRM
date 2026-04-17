"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Instagram, Layers, Linkedin, Plus, Twitter, Users, X, Youtube, Video, PlayCircle } from "lucide-react";
import MeetingRecordingList from "@/components/meetings/MeetingRecordingList";
import toast from "react-hot-toast";
import { WorkspacePostCard } from "@/components/workspaces/WorkspacePostCard";
import { WorkspaceTaskModal } from "@/components/workspaces/WorkspaceTaskModal";
import type { WorkspaceTask, WorkspaceMember } from "@/components/workspaces/types";
import { usePresence } from "@/components/layout/PresenceProvider";
import { AvatarStack } from "@/components/projects/AvatarStack";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"];

type Workspace = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  createdById: string;
  members: WorkspaceMember[];
  tasks: WorkspaceTask[];
};

type SearchUser = { id: string; name: string; role: string };

const TYPE_ICONS: Record<string, React.ElementType> = {
  INSTAGRAM: Instagram,
  LINKEDIN: Linkedin,
  TWITTER: Twitter,
  YOUTUBE: Youtube,
  GENERAL: Layers,
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  PROJECT_MANAGER: "PM",
  DEVELOPER: "Developer",
  DESIGNER: "Designer",
  HR: "HR",
  ACCOUNTANT: "Accountant",
  SALES: "Sales",
  CLIENT: "Client",
};

export default function WorkspaceBoardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workspaceId = params?.id ?? "";

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);

  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedTask, setSelectedTask] = useState<WorkspaceTask | null>(null);
  const [newTaskModal, setNewTaskModal] = useState<WorkspaceTask["status"] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  const [startingMeeting, setStartingMeeting] = useState(false);
  const [recordingsOpen, setRecordingsOpen] = useState(false);
  const presenceMap = usePresence();

  const reloadWorkspace = useCallback(async () => {
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}`);
      const d = (await r.json()) as { data?: Workspace; error?: string };
      if (d.data) setWorkspace(d.data);
    } catch {
      toast.error("Failed to sync workspace", { style: TOAST_ERROR_STYLE });
    }
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/workspaces/${workspaceId}`).then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ])
      .then(([wsRes, meRes]: [{ data?: Workspace; error?: string }, { data?: { id: string; role: string } }]) => {
        if (cancelled) return;
        if (wsRes.data) setWorkspace(wsRes.data);
        else toast.error("Board not found", { style: TOAST_ERROR_STYLE });
        if (meRes.data) setCurrentUser({ id: meRes.data.id, role: meRes.data.role });
      })
      .catch(() => toast.error("Failed to load", { style: TOAST_ERROR_STYLE }))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function startMeeting() {
    if (!workspace) return;
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
          title: `${workspace.name} Board Discussion`, 
          workspaceId: workspace.id 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start meeting");
      meetingTab.location.href = `/meetings/${data.data.meetingId}`;
      toast.success("Meeting started", { style: TOAST_STYLE });
    } catch (e: any) {
      meetingTab.close();
      toast.error(e.message, { style: TOAST_ERROR_STYLE });
    } finally {
      setStartingMeeting(false);
    }
  }

  useEffect(() => {
    if (!membersModalOpen) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = userSearch.trim();
    if (q.length < 1) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      setSearchBusy(true);
      fetch(`/api/users?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: { data?: SearchUser[] }) => {
          setSearchResults(d.data ?? []);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchBusy(false));
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [userSearch, membersModalOpen]);

  function handleTaskUpdate(taskId: string, data: Partial<WorkspaceTask>) {
    setWorkspace((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...data } : t)),
          }
        : prev
    );
    setSelectedTask((prev) => (prev?.id === taskId ? { ...prev, ...data } : prev));
  }

  function handleTaskDelete(taskId: string) {
    setWorkspace((prev) =>
      prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) } : prev
    );
    setSelectedTask((prev) => (prev?.id === taskId ? null : prev));
    toast.success("Post deleted", { style: TOAST_STYLE });
  }

  async function createTask() {
    if (!newTitle.trim() || !newTaskModal) return;
    setCreatingTask(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), status: newTaskModal }),
      });
      const data = (await res.json()) as { data?: WorkspaceTask; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setWorkspace((prev) =>
        prev ? { ...prev, tasks: [...prev.tasks, data.data!] } : prev
      );
      setNewTaskModal(null);
      setNewTitle("");
      toast.success("Post created", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setCreatingTask(false);
    }
  }

  async function addMember(userId: string) {
    setMemberBusyId(userId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed");
      await reloadWorkspace();
      setUserSearch("");
      setSearchResults([]);
      toast.success("Member added", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setMemberBusyId(null);
    }
  }

  async function removeMember(targetUserId: string) {
    setMemberBusyId(targetUserId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${targetUserId}`, {
        method: "DELETE",
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed");
      if (currentUser?.id === targetUserId) {
        setMembersModalOpen(false);
        router.push("/workspaces");
        toast.success("You left the board", { style: TOAST_STYLE });
        return;
      }
      await reloadWorkspace();
      toast.success("Member removed", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setMemberBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }
  if (!workspace || !currentUser) return null;

  const Icon = TYPE_ICONS[workspace.type] ?? Layers;

  const canManageMembers =
    MANAGER_ROLES.includes(currentUser.role) || workspace.createdById === currentUser.id;

  const memberIds = new Set(workspace.members.map((m) => m.userId));

  const currentPosts = workspace.tasks.filter((t) =>
    ["IDEA", "IN_PROGRESS", "IN_REVIEW"].includes(t.status)
  );
  const pastPosts = workspace.tasks.filter((t) =>
    ["APPROVED", "PUBLISHED", "ARCHIVED"].includes(t.status)
  );

  return (
    <>
      <div className="space-y-10 max-w-[1600px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-base-300 border border-base-300">
              <Icon className="w-7 h-7 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-base-content/40">
                Social media section
              </p>
              <h1 className="text-2xl font-bold text-base-content tracking-tight">{workspace.name}</h1>
              {workspace.description && (
                <p className="text-sm text-base-content/55 mt-1 max-w-2xl">{workspace.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button 
                className="btn btn-sm btn-ghost gap-2"
                onClick={() => setRecordingsOpen(true)}
              >
                <PlayCircle className="w-4 h-4" />
                Recordings
              </button>
              <button 
                className="btn btn-sm btn-primary gap-2"
                onClick={startMeeting}
                disabled={startingMeeting}
              >
                {startingMeeting ? <span className="loading loading-spinner loading-xs" /> : <Video className="w-4 h-4" />}
                Start Meeting
              </button>
              <button className="btn btn-sm btn-outline gap-2" onClick={() => setMembersModalOpen(true)}>
                <Plus className="w-4 h-4" />
                Manage Members
              </button>
            </div>
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-300/50 border border-base-300 cursor-pointer hover:bg-base-300 transition-colors"
              onClick={() => {
                setMembersModalOpen(true);
                setUserSearch("");
                setSearchResults([]);
              }}
            >
              <AvatarStack 
                users={workspace.members.slice(0, 3).map(m => m.user)} 
                overflow={Math.max(0, workspace.members.length - 3)}
                presenceMap={presenceMap}
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-base-content leading-none">
                  {workspace.members.length} members
                </span>
                <span className="text-[10px] text-success font-medium leading-none mt-0.5">
                  {workspace.members.filter(m => presenceMap[m.userId] === "online").length} online
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Current posts */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-base-300 pb-4">
            <div>
              <h2 className="text-xl font-semibold text-base-content">Current posts</h2>
              <p className="text-sm text-base-content/50 mt-0.5">
                Ideas, in progress, and in review. Update status inside each post.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary gap-2"
              onClick={() => {
                setNewTaskModal("IDEA");
                setNewTitle("");
              }}
            >
              <Plus className="w-4 h-4" />
              New post
            </button>
          </div>

          {currentPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-base-300 bg-base-200/50 py-16 text-center px-4">
              <p className="text-base-content/50 text-sm max-w-md mx-auto">
                No active posts yet. Create a post to plan content before it is approved or published.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm mt-4 gap-2"
                onClick={() => {
                  setNewTaskModal("IDEA");
                  setNewTitle("");
                }}
              >
                <Plus className="w-4 h-4" />
                New post
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
              {currentPosts.map((task) => (
                <WorkspacePostCard
                  key={task.id}
                  task={task}
                  members={workspace.members}
                  onClick={() => setSelectedTask(task)}
                  presenceMap={presenceMap}
                />
              ))}
            </div>
          )}
        </section>

        {/* Past posts */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-base-300 pb-4">
            <div>
              <h2 className="text-xl font-semibold text-base-content">Past posts</h2>
              <p className="text-sm text-base-content/50 mt-0.5">
                Approved, published, and archived — finished or live content.
              </p>
            </div>
          </div>

          {pastPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-base-300 bg-base-200/50 py-12 text-center px-4">
              <p className="text-base-content/50 text-sm">
                Nothing in the archive yet. Move posts here when they are approved or published.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
              {pastPosts.map((task) => (
                <WorkspacePostCard
                  key={task.id}
                  task={task}
                  members={workspace.members}
                  onClick={() => setSelectedTask(task)}
                  presenceMap={presenceMap}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedTask && (
        <WorkspaceTaskModal
          task={selectedTask}
          members={workspace.members}
          workspaceId={workspaceId}
          userRole={currentUser?.role ?? ""}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
          presenceMap={presenceMap}
        />
      )}

      {recordingsOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl bg-base-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">Workspace Recordings</h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setRecordingsOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <MeetingRecordingList workspaceId={workspaceId} />
          </div>
          <div className="modal-backdrop" onClick={() => setRecordingsOpen(false)} />
        </div>
      )}

      <dialog className={`modal ${newTaskModal ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base-content">New post</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setNewTaskModal(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="form-control gap-1">
            <label className="label py-0">
              <span className="label-text">Title</span>
            </label>
            <input
              type="text"
              className="input input-bordered bg-base-100"
              placeholder="Post title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && void createTask()}
            />
          </div>
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={() => setNewTaskModal(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void createTask()}
              disabled={creatingTask || !newTitle.trim()}
            >
              {creatingTask && <span className="loading loading-spinner loading-sm" />}
              Create
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setNewTaskModal(null)} />
      </dialog>

      <dialog className={`modal ${membersModalOpen ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">Members</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setMembersModalOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {canManageMembers && (
            <div className="form-control gap-2 mb-4">
              <label className="label py-0">
                <span className="label-text">Add people</span>
              </label>
              <input
                type="search"
                className="input input-bordered input-sm bg-base-100"
                placeholder="Search by name…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                autoComplete="off"
              />
              {searchBusy && (
                <span className="loading loading-spinner loading-sm text-primary" />
              )}
              {userSearch.trim().length > 0 && !searchBusy && searchResults.length > 0 && (
                <ul className="menu menu-sm bg-base-100 rounded-box border border-base-300 max-h-52 overflow-y-auto p-1 shadow-sm divide-y divide-base-200">
                  {searchResults
                    .filter((u) => !memberIds.has(u.id))
                    .map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          className="flex items-center gap-3 p-2 hover:bg-base-200 focus:bg-base-200 disabled:opacity-50 text-left"
                          disabled={memberBusyId === u.id}
                          onClick={() => void addMember(u.id)}
                        >
                          <UserAvatar user={u} size={28} />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium block truncate">{u.name}</span>
                            <span className="text-[10px] text-base-content/40 uppercase block">
                              {ROLE_LABELS[u.role] ?? u.role}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
              {userSearch.trim().length > 0 &&
                !searchBusy &&
                searchResults.length > 0 &&
                searchResults.every((u) => memberIds.has(u.id)) && (
                  <p className="text-xs text-base-content/50">
                    Everyone matching search is already on this board.
                  </p>
                )}
            </div>
          )}
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {workspace.members.map((m) => {
              const isSelf = m.userId === currentUser.id;
              const showLeave = isSelf && workspace.members.length > 1;
              const showRemove = !isSelf && canManageMembers;
              const isOnline = presenceMap[m.userId] === "online";
              
              return (
                <li
                  key={m.userId}
                  className="flex items-center justify-between gap-2 rounded-lg bg-base-100 px-3 py-2 border border-base-300"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar 
                      user={m.user} 
                      size={32} 
                      showPresence 
                      isOnline={isOnline} 
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-base-content truncate">
                        {m.user.name} {isSelf && <span className="text-primary font-normal">(You)</span>}
                      </p>
                      <p className="text-[10px] text-base-content/40 uppercase tracking-wider">
                        {ROLE_LABELS[m.user.role] ?? m.user.role}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex gap-1">
                    {showRemove && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                        disabled={memberBusyId === m.userId}
                        onClick={() => setMemberToRemove(m.userId)}
                      >
                        Remove
                      </button>
                    )}
                    {showLeave && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-base-content/70 hover:bg-base-300"
                        disabled={memberBusyId === m.userId}
                        onClick={() => setMemberToRemove(m.userId)}
                      >
                        Leave
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="modal-backdrop" onClick={() => setMembersModalOpen(false)} />
      </dialog>

      {/* Remove Member Confirmation */}
      <dialog className={`modal ${memberToRemove ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-sm text-center">
          <h3 className="font-bold text-lg mb-4">
            {memberToRemove === currentUser.id ? "Leave Board?" : "Remove Member?"}
          </h3>
          <p className="text-sm text-base-content/60 mb-6">
            {memberToRemove === currentUser.id 
              ? "Are you sure you want to leave this board? You will need an invite to rejoin." 
              : "Are you sure you want to remove this person from the board?"}
          </p>
          <div className="flex gap-2">
            <button className="btn btn-ghost flex-1" onClick={() => setMemberToRemove(null)}>Cancel</button>
            <button 
              className="btn btn-error flex-1" 
              onClick={() => {
                if (memberToRemove) void removeMember(memberToRemove);
                setMemberToRemove(null);
              }}
              disabled={!!memberBusyId}
            >
              {memberBusyId ? <span className="loading loading-spinner loading-sm" /> : (memberToRemove === currentUser.id ? "Leave" : "Remove")}
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setMemberToRemove(null)} />
      </dialog>
    </>
  );
}

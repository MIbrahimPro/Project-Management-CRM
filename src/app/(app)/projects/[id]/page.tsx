"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  CheckCircle2,
  Circle,
  FileText,
  HelpCircle,
  MessageSquare,
  Pencil,
  Users,
  Video,
  VideoOff,
  X,
  PlayCircle,
} from "lucide-react";
import MeetingRecordingList from "@/components/meetings/MeetingRecordingList";
import toast from "react-hot-toast";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { usePresence } from "@/components/layout/PresenceProvider";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Check } from "lucide-react";

const StandaloneEditor = dynamic(
  () => import("@/components/documents/StandaloneEditor"),
  { ssr: false }
);

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type StartMeetingResponse = {
  meetingId: string;
};

type MilestoneStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";

type Milestone = {
  id: string;
  title: string;
  content?: string | null;
  status: MilestoneStatus;
  order: number;
};

type Member = {
  id: string;
  role: string;
  user: { id: string; name: string; profilePicUrl: string | null; role: string };
};

type Client = { id: string; name: string; profilePicUrl: string | null };

type Project = {
  id: string;
  title: string;
  status: string;
  price: number | null;
  projectDescription?: string;
  milestones: Milestone[];
  members: Member[];
  client: Client | null;
  _count: { documents: number; questions: number };
  unreadMessages: number;
  unansweredQuestions: number;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "badge-neutral",
  ACTIVE: "badge-success",
  ON_HOLD: "badge-warning",
  COMPLETED: "badge-info",
  CANCELLED: "badge-error",
};

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER: "Developer",
  DESIGNER: "Designer",
  ADMIN: "Admin",
  PROJECT_MANAGER: "PM",
  SUPER_ADMIN: "Super Admin",
  HR: "HR",
  ACCOUNTANT: "Accountant",
  SALES: "Sales",
};

export default function ProjectDashboardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [startingMeeting, setStartingMeeting] = useState(false);
  const presenceMap = usePresence();

  // Edit team modal
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [editMemberIds, setEditMemberIds] = useState<Set<string>>(new Set());
  const [savingTeam, setSavingTeam] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editClientId, setEditClientId] = useState("");
  const [recordingsOpen, setRecordingsOpen] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [editMilestonesOpen, setEditMilestonesOpen] = useState(false);
  const [draftMilestones, setDraftMilestones] = useState<Milestone[]>([]);
  const [savingMilestones, setSavingMilestones] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const [creatingTask, setCreatingTask] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    Promise.all([
      fetch(`/api/projects/${params.id}`).then((r) => r.json()),
      fetch(`/api/projects/${params.id}/tasks`).then((r) => r.json()),
      fetch("/api/users/me").then((r) => r.json()),
    ])
      .then(([projRes, tasksRes, userRes]: [
        { data?: Project; error?: string },
        { data?: any[] },
        { data: { id: string; name: string; role: string } }
      ]) => {
        if (projRes.error || !projRes.data) throw new Error(projRes.error ?? "Not found");
        setProject(projRes.data);
        setTasks(tasksRes.data ?? []);
        setCurrentUser(userRes.data);
      })
      .catch(() => {
        toast.error("Failed to load project", { style: TOAST_ERROR_STYLE });
      })
      .finally(() => {
        setLoading(false);
        setTasksLoading(false);
      });
  }, [params?.id]);

  async function openEditTeam() {
    setEditMemberIds(new Set(project?.members.map((m) => m.user.id) ?? []));
    if (allUsers.length === 0) {
      try {
        const res = await fetch("/api/users");
        const data = (await res.json()) as { data: { id: string; name: string; role: string }[] };
        setAllUsers((data.data ?? []).filter((u) => u.role !== "CLIENT"));
      } catch { /* ignore */ }
    }
    setEditTeamOpen(true);
  }

  async function openEditClient() {
    if (!project) return;
    setEditClientId(project.client?.id ?? "");
    if (clients.length === 0) {
      try {
        const res = await fetch("/api/users/clients");
        const data = (await res.json()) as { data?: Client[] };
        setClients(data.data ?? []);
      } catch {
        // ignore and keep modal available
      }
    }
    setEditClientOpen(true);
  }

  async function saveClient() {
    if (!project) return;
    setSavingClient(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: editClientId || null }),
      });
      if (!res.ok) throw new Error("Failed");
      const projRes = await fetch(`/api/projects/${project.id}`);
      const projData = (await projRes.json()) as { data: Project };
      setProject(projData.data);
      setEditClientOpen(false);
      toast.success("Client updated", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to update client", { style: TOAST_ERROR_STYLE });
    } finally {
      setSavingClient(false);
    }
  }

  function openEditMilestones() {
    setDraftMilestones((project?.milestones ?? []).map((m) => ({ ...m })));
    setEditMilestonesOpen(true);
  }

  function updateDraftMilestone(id: string, field: "title" | "content", value: string) {
    setDraftMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  }

  function removeDraftMilestone(id: string) {
    setDraftMilestones((prev) => prev.filter((m) => m.id !== id));
  }

  function addDraftMilestone() {
    setDraftMilestones((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: "",
        content: "",
        status: "NOT_STARTED",
        order: prev.length,
      },
    ]);
  }

  async function saveMilestones() {
    if (!project) return;
    if (draftMilestones.some((m) => !m.title.trim())) {
      toast.error("Each milestone needs a title", { style: TOAST_ERROR_STYLE });
      return;
    }
    setSavingMilestones(true);
    try {
      const payload = draftMilestones.map((m) => ({
        ...(m.id.startsWith("new-") ? {} : { id: m.id }),
        title: m.title.trim(),
        content: m.content ?? "",
        status: m.status,
      }));
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestones: payload }),
      });
      if (!res.ok) throw new Error("Failed");
      const projRes = await fetch(`/api/projects/${project.id}`);
      const projData = (await projRes.json()) as { data: Project };
      setProject(projData.data);
      setEditMilestonesOpen(false);
      toast.success("Milestones updated", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to update milestones", { style: TOAST_ERROR_STYLE });
    } finally {
      setSavingMilestones(false);
    }
  }

  async function saveTeam() {
    if (!project) return;
    setSavingTeam(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamMemberIds: Array.from(editMemberIds) }),
      });
      if (!res.ok) throw new Error("Failed");
      // Refresh project data
      const projRes = await fetch(`/api/projects/${project.id}`);
      const projData = (await projRes.json()) as { data: Project };
      setProject(projData.data);
      setEditTeamOpen(false);
      toast.success("Team updated", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to update team", { style: TOAST_ERROR_STYLE });
    } finally {
      setSavingTeam(false);
    }
  }

  async function createTask() {
    if (!project || !taskTitle.trim()) return;
    setCreatingTask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          projectId: project.id,
          assigneeIds: taskAssignees,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      
      // The task API returns the new task. We need to fetch the full task 
      // with relations or manually inject them.
      // Easiest is to refresh the project tasks.
      const taskRes = await fetch(`/api/projects/${project.id}/tasks`);
      const taskData = await taskRes.json();
      setTasks(taskData.data ?? []);
      
      setTaskTitle("");
      setTaskAssignees([]);
      setShowTaskModal(false);
      toast.success("Task created", { style: TOAST_STYLE });
    } catch (e: any) {
      toast.error(e.message, { style: TOAST_ERROR_STYLE });
    } finally {
      setCreatingTask(false);
    }
  }

  function openNewTaskModal() {
    setTaskTitle("");
    // Auto-assign all team members by default
    setTaskAssignees(project?.members.map(m => m.user.id) ?? []);
    setShowTaskModal(true);
  }

  async function startMeeting() {
    if (!project || !currentUser) return;
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
        body: JSON.stringify({ title: `${project.title} — Meeting`, projectId: project.id }),
      });
      const data = (await res.json()) as {
        data?: StartMeetingResponse;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to start meeting");
      if (!data.data) throw new Error("Failed to start meeting");
      meetingTab.location.href = `/meetings/${data.data.meetingId}`;
      toast.success("Meeting started", { style: TOAST_STYLE });
    } catch (e) {
      meetingTab.close();
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setStartingMeeting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16 text-base-content/40">
        <p className="text-lg">Project not found</p>
      </div>
    );
  }

  const isClient = currentUser?.role === "CLIENT";
  const isManager = !!currentUser && ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(currentUser.role);
  const completedMilestones = project.milestones.filter((m) => m.status === "COMPLETED").length;
  const totalMilestones = project.milestones.length;
  const progress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  async function changeMilestoneStatus(milestoneId: string, newStatus: MilestoneStatus) {
    if (!project) return;
    // Optimistic update
    setProject((prev) =>
      prev
        ? { ...prev, milestones: prev.milestones.map((m) => (m.id === milestoneId ? { ...m, status: newStatus } : m)) }
        : prev,
    );
    try {
      const res = await fetch(`/api/projects/${project.id}/milestones/${milestoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Milestone updated", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to update milestone", { style: TOAST_ERROR_STYLE });
      // refetch to revert
      void fetch(`/api/projects/${project.id}`)
        .then((r) => r.json())
        .then((d: { data?: Project }) => d.data && setProject(d.data));
    }
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-base-content">{project.title}</h1>
            <span className={`badge ${STATUS_COLORS[project.status] ?? "badge-neutral"} badge-sm`}>
              {project.status.replace("_", " ")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isClient && (
            <button
              className="btn btn-primary btn-sm gap-2"
              onClick={() => void startMeeting()}
              disabled={startingMeeting}
            >
              {startingMeeting ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Video className="w-4 h-4" />
              )}
              Start Meeting
            </button>
          )}
          {project.price != null && (
            <div className="text-right">
              <p className="text-xs text-base-content/40">Budget</p>
              <p className="text-xl font-semibold text-base-content">
                ${Number(project.price).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {project.projectDescription?.trim() && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Project Description</h2>
            <p className="text-sm whitespace-pre-wrap text-base-content/80">
              {project.projectDescription}
            </p>
          </div>
        </div>
      )}

      {/* Quick-nav cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          className="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer text-left"
          onClick={() => router.push(`/projects/${project.id}/chat`)}
        >
          <div className="card-body p-4">
            <MessageSquare className="w-5 h-5 text-primary mb-1" />
            <p className="text-xs text-base-content/50">Chat</p>
            {project.unreadMessages > 0 && (
              <span className="badge badge-primary badge-sm">{project.unreadMessages} new</span>
            )}
          </div>
        </button>

        <button
          className="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer text-left"
          onClick={() => router.push(`/projects/${project.id}/documents`)}
        >
          <div className="card-body p-4">
            <FileText className="w-5 h-5 text-secondary mb-1" />
            <p className="text-xs text-base-content/50">Documents</p>
            <p className="text-sm font-medium text-base-content">{project._count.documents}</p>
          </div>
        </button>

        <button
          className="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer text-left"
          onClick={() => router.push(`/projects/${project.id}/questions`)}
        >
          <div className="card-body p-4">
            <HelpCircle className="w-5 h-5 text-warning mb-1" />
            <p className="text-xs text-base-content/50">Questions</p>
            {project.unansweredQuestions > 0 ? (
              <span className="badge badge-warning badge-sm">{project.unansweredQuestions} pending</span>
            ) : (
              <p className="text-sm font-medium text-base-content">{project._count.questions}</p>
            )}
          </div>
        </button>

        <button
          className="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer text-left"
          onClick={() => setRecordingsOpen(true)}
        >
          <div className="card-body p-4">
            <PlayCircle className="w-5 h-5 text-info mb-1" />
            <p className="text-xs text-base-content/50">Recordings</p>
            <p className="text-sm font-medium text-base-content">View clips</p>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Milestones & Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Milestones */}
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body">
              <div className="flex items-center justify-between mb-2">
                <h2 className="card-title text-base">Milestones</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-base-content/50">
                    {completedMilestones} / {totalMilestones}
                  </span>
                  {isManager && (
                    <button
                      className="btn btn-ghost btn-xs btn-circle"
                      onClick={openEditMilestones}
                      title="Edit milestones"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-base-300 rounded-full h-2 mb-4">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-base-content/50 mb-4">{progress}% complete</p>

              {project.milestones.length === 0 ? (
                <p className="text-center py-6 text-base-content/40 text-sm">No milestones</p>
              ) : (
                <div className="space-y-2">
                  {project.milestones.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-base-300">
                      {m.status === "COMPLETED" ? (
                        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                      ) : m.status === "IN_PROGRESS" ? (
                        <Circle className="w-4 h-4 text-warning flex-shrink-0" />
                      ) : m.status === "BLOCKED" ? (
                        <Circle className="w-4 h-4 text-error flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-base-content/20 flex-shrink-0" />
                      )}
                      <span
                        className={`text-sm flex-1 ${
                          m.status === "COMPLETED" ? "line-through text-base-content/40" : "text-base-content"
                        }`}
                      >
                        {m.title}
                      </span>
                      {isManager ? (
                        <select
                          className="select select-xs select-bordered bg-base-100"
                          value={m.status}
                          onChange={(e) => void changeMilestoneStatus(m.id, e.target.value as MilestoneStatus)}
                        >
                          <option value="NOT_STARTED">Not Started</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="BLOCKED">Blocked</option>
                          <option value="COMPLETED">Done</option>
                        </select>
                      ) : (
                        <>
                          {m.status === "IN_PROGRESS" && (
                            <span className="badge badge-warning badge-xs">In Progress</span>
                          )}
                          {m.status === "BLOCKED" && (
                            <span className="badge badge-error badge-xs">Blocked</span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tasks Section */}
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-title text-base">Project Tasks</h2>
                <button 
                  className="btn btn-primary btn-xs"
                  onClick={openNewTaskModal}
                >
                  New Task
                </button>
              </div>

              {tasksLoading ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-sm text-primary" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-base-300 py-10 text-center">
                  <p className="text-sm text-base-content/40">No tasks created for this project</p>
                  <button 
                    className="btn btn-link btn-sm mt-1"
                    onClick={openNewTaskModal}
                  >
                    Create first task
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tasks.slice(0, 6).map((t) => (
                    <TaskCard 
                      key={t.id} 
                      task={t} 
                      onClick={() => router.push(`/tasks/${t.id}`)}
                      presenceMap={presenceMap}
                    />
                  ))}
                </div>
              )}
              {tasks.length > 6 && (
                <div className="mt-4 text-center">
                  <button 
                    className="btn btn-ghost btn-sm"
                    onClick={() => router.push("/tasks?tab=project")}
                  >
                    View all project tasks
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Team + Client */}
        <div className="space-y-4">
          {/* Client */}
          {project.client && (
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4 relative">
                <h2 className="font-semibold text-sm text-base-content mb-3">Client</h2>
                {isManager && (
                  <button
                    className="btn btn-ghost btn-xs btn-circle absolute right-4 top-4"
                    onClick={() => void openEditClient()}
                    title="Edit client"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                <div className="flex items-center gap-3">
                  <UserAvatar
                    user={{ name: project.client.name, profilePicUrl: project.client.profilePicUrl }}
                    size={32}
                    showPresence
                    isOnline={presenceMap[project.client.id] === "online"}
                  />
                  <p className="text-sm font-medium text-base-content">{project.client.name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Team */}
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm text-base-content">
                  Team ({project.members.length})
                  <span className="text-[10px] text-success font-medium ml-1.5">
                    ({project.members.filter(m => presenceMap[m.user.id] === "online").length} online)
                  </span>
                </h2>
                {isManager && (
                  <button
                    className="btn btn-ghost btn-xs btn-circle"
                    onClick={() => void openEditTeam()}
                    title="Edit team"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              {project.members.length === 0 ? (
                <p className="text-sm text-base-content/40">No members yet</p>
              ) : (
                <div className="space-y-2">
                  {project.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <UserAvatar
                        user={{ name: m.user.name, profilePicUrl: m.user.profilePicUrl }}
                        size={28}
                        showPresence
                        isOnline={presenceMap[m.user.id] === "online"}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-base-content truncate">{m.user.name}</p>
                        <p className="text-xs text-base-content/40">
                          {ROLE_LABELS[m.user.role] ?? m.user.role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Team Modal */}
      <dialog className={`modal ${editTeamOpen ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">Edit Team</h3>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setEditTeamOpen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {allUsers.map((u) => (
              <label key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={editMemberIds.has(u.id)}
                  onChange={(e) => {
                    const next = new Set(editMemberIds);
                    if (e.target.checked) next.add(u.id); else next.delete(u.id);
                    setEditMemberIds(next);
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-base-content truncate">{u.name}</p>
                  <p className="text-xs text-base-content/50">{ROLE_LABELS[u.role] ?? u.role}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setEditTeamOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void saveTeam()} disabled={savingTeam}>
              {savingTeam && <span className="loading loading-spinner loading-sm" />}
              Save
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setEditTeamOpen(false)} />
      </dialog>

      {/* Edit Client Modal */}
      <dialog className={`modal ${editClientOpen ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">Change Client</h3>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setEditClientOpen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <select
            className="select select-bordered bg-base-100 w-full"
            value={editClientId}
            onChange={(e) => setEditClientId(e.target.value)}
          >
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setEditClientOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => void saveClient()} disabled={savingClient}>
              {savingClient && <span className="loading loading-spinner loading-sm" />}
              Save
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setEditClientOpen(false)} />
      </dialog>

      {/* Edit Milestones Modal */}
      <dialog className={`modal ${editMilestonesOpen ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">Edit Milestones</h3>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setEditMilestonesOpen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {draftMilestones.map((m, idx) => (
              <div key={m.id} className="bg-base-300 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-base-content/60">Milestone {idx + 1}</span>
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => removeDraftMilestone(m.id)}
                    disabled={draftMilestones.length <= 1}
                  >
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  className="input input-bordered input-sm bg-base-100 w-full"
                  value={m.title}
                  placeholder="Milestone title"
                  onChange={(e) => updateDraftMilestone(m.id, "title", e.target.value)}
                />
                <div className="bg-base-100 border border-base-300 rounded-lg p-2">
                  <p className="text-xs text-base-content/50 mb-2">Requirements / Description</p>
                  <StandaloneEditor
                    initialContent={m.content ?? ""}
                    onChange={(json) => updateDraftMilestone(m.id, "content", json)}
                  />
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm mt-3" onClick={addDraftMilestone}>
            Add Milestone
          </button>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setEditMilestonesOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => void saveMilestones()} disabled={savingMilestones}>
              {savingMilestones && <span className="loading loading-spinner loading-sm" />}
              Save Milestones
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setEditMilestonesOpen(false)} />
      </dialog>
    </div>
      {/* New Task Modal */}
      <dialog className={`modal ${showTaskModal ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">New Project Task</h3>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowTaskModal(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text">Title</span></label>
              <input
                type="text"
                className="input input-bordered bg-base-100"
                placeholder="What needs to be done?"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void createTask()}
              />
            </div>

            {project.members.length > 0 && (
              <div className="form-control gap-1">
                <label className="label py-0">
                  <span className="label-text">Assignees</span>
                </label>
                <div className="bg-base-100 border border-base-300 rounded-lg max-h-48 overflow-y-auto divide-y divide-base-300">
                  {project.members.map((m) => {
                    const assigned = taskAssignees.includes(m.user.id);
                    return (
                      <button
                        key={m.user.id}
                        type="button"
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-base-200 transition-colors ${
                          assigned ? "bg-primary/5" : ""
                        }`}
                        onClick={() =>
                          setTaskAssignees((prev) =>
                            assigned ? prev.filter((id) => id !== m.user.id) : [...prev, m.user.id]
                          )
                        }
                      >
                        <UserAvatar 
                          user={{ name: m.user.name, profilePicUrl: m.user.profilePicUrl }}
                          size={28}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-base-content truncate">{m.user.name}</p>
                          <p className="text-[10px] text-base-content/40 uppercase tracking-wider">
                            {ROLE_LABELS[m.user.role] ?? m.user.role}
                          </p>
                        </div>
                        {assigned && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setShowTaskModal(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => void createTask()}
              disabled={creatingTask || !taskTitle.trim()}
            >
              {creatingTask && <span className="loading loading-spinner loading-sm" />}
              Create Task
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setShowTaskModal(false)} />
      </dialog>

      {/* Recordings Modal */}
      {recordingsOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl bg-base-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">Meeting Recordings</h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setRecordingsOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <MeetingRecordingList projectId={project.id} />
          </div>
          <div className="modal-backdrop" onClick={() => setRecordingsOpen(false)} />
        </div>
      )}
    </>
  );
}

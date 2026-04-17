"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Kanban, Plus, X, Check } from "lucide-react";
import toast from "react-hot-toast";
import { TaskKanban, type TaskCard, type TaskStatus } from "@/components/tasks/TaskKanban";
import { TaskCard as TaskCardComponent } from "@/components/tasks/TaskCard";
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal";
import { AvatarStack } from "@/components/projects/AvatarStack";
import { usePresence } from "@/components/layout/PresenceProvider";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

const STATUS_BADGE: Record<TaskStatus, string> = {
  TODO: "badge-neutral",
  IN_PROGRESS: "badge-warning",
  IN_REVIEW: "badge-info",
  DONE: "badge-success",
  CANCELLED: "badge-error",
};

type TeamMember = { id: string; name: string; role: string; profilePicUrl: string | null };
type Project = { id: string; title: string };

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [tab, setTab] = useState<"all" | "general" | "project">("all");
  const presenceMap = usePresence();

  // Task detail modal
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // New task modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [projectId, setProjectId] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ])
      .then(([tasksRes, projRes, usersRes]: [
        { data: TaskCard[] },
        { data: Project[] },
        { data: TeamMember[] },
      ]) => {
        setTasks(tasksRes.data ?? []);
        setProjects(projRes.data ?? []);
        setTeamMembers((usersRes.data ?? []).filter((u) => u.role !== "CLIENT"));
      })
      .catch(() => toast.error("Failed to load", { style: TOAST_ERROR_STYLE }))
      .finally(() => setLoading(false));
  }, []);

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      toast.error("Failed to update", { style: TOAST_ERROR_STYLE });
      // revert handled by re-fetch below
    }
  }

  async function createTask() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          status,
          projectId: projectId || null,
          assigneeIds,
        }),
      });
      const data = (await res.json()) as { data?: TaskCard; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setTasks((prev) => [data.data!, ...prev]);
      setShowModal(false);
      setTitle(""); setStatus("TODO"); setProjectId(""); setAssigneeIds([]);
      toast.success("Task created", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const currentTasks = tasks.filter((t) => ["TODO", "IN_PROGRESS", "IN_REVIEW"].includes(t.status));
  const pastTasks = tasks.filter((t) => ["DONE", "CANCELLED"].includes(t.status));

  const filteredCurrent = currentTasks.filter((t) => {
    if (tab === "general") return !t.project;
    if (tab === "project") return !!t.project;
    return true;
  });

  const filteredPast = pastTasks.filter((t) => {
    if (tab === "general") return !t.project;
    if (tab === "project") return !!t.project;
    return true;
  });
  
  return (
    <>
      <div className="space-y-10 max-w-[1600px] mx-auto">
        {/* Header (stays mostly same) */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-base-content">Tasks</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="tabs tabs-boxed tabs-xs bg-base-300">
                <button className={`tab ${tab === "all" ? "tab-active" : ""}`} onClick={() => setTab("all")}>All</button>
                <button className={`tab ${tab === "general" ? "tab-active" : ""}`} onClick={() => setTab("general")}>General</button>
                <button className={`tab ${tab === "project" ? "tab-active" : ""}`} onClick={() => setTab("project")}>Project</button>
              </div>
              <span className="text-xs text-base-content/40">
                {tasks.length} task{tasks.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="join">
              <button
                className={`btn btn-sm join-item gap-1 ${view === "list" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setView("list")}
              >
                <CheckSquare className="w-4 h-4" />
                List
              </button>
              <button
                className={`btn btn-sm join-item gap-1 ${view === "kanban" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setView("kanban")}
              >
                <Kanban className="w-4 h-4" />
                Board
              </button>
            </div>
            <button
              className="btn btn-primary btn-sm gap-2"
              onClick={() => setShowModal(true)}
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          </div>
        </div>

        {view === "kanban" ? (
          <TaskKanban
            tasks={[...filteredCurrent, ...filteredPast]}
            onStatusChange={handleStatusChange}
            onTaskClick={(t) => setSelectedTaskId(t.id)}
          />
        ) : (
          <div className="space-y-12">
            {/* Current Tasks */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-base-300 pb-3">
                <h2 className="text-lg font-bold text-base-content/80">Current Tasks</h2>
                <span className="badge badge-sm badge-neutral">{filteredCurrent.length}</span>
              </div>
              
              {filteredCurrent.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-base-300 bg-base-200/50 py-12 text-center">
                  <p className="text-sm text-base-content/40">No active tasks in this view</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredCurrent.map((t) => (
                    <TaskCardComponent 
                      key={t.id} 
                      task={t} 
                      onClick={() => setSelectedTaskId(t.id)}
                      presenceMap={presenceMap}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Past Tasks */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-base-300 pb-3">
                <h2 className="text-lg font-bold text-base-content/40">Archive</h2>
                <span className="badge badge-sm badge-ghost">{filteredPast.length}</span>
              </div>
              
              {filteredPast.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-base-300 bg-base-200/50 py-12 text-center">
                  <p className="text-sm text-base-content/40">Nothing in the archive yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-70">
                  {filteredPast.map((t) => (
                    <TaskCardComponent 
                      key={t.id} 
                      task={t} 
                      onClick={() => setSelectedTaskId(t.id)}
                      presenceMap={presenceMap}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* New Task Modal */}
      <dialog className={`modal ${showModal ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">New Task</h3>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowModal(false)}>
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void createTask()}
              />
            </div>
            
            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text">Project (optional)</span></label>
              <select
                className="select select-bordered select-sm bg-base-100"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">None (General Task)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            {teamMembers.length > 0 && (
              <div className="form-control gap-1">
                <label className="label py-0">
                  <span className="label-text">Assignees</span>
                </label>
                <div className="bg-base-100 border border-base-300 rounded-lg max-h-48 overflow-y-auto divide-y divide-base-300">
                  {teamMembers.map((m) => {
                    const assigned = assigneeIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-base-200 transition-colors ${
                          assigned ? "bg-primary/5" : ""
                        }`}
                        onClick={() =>
                          setAssigneeIds((prev) =>
                            assigned ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                          )
                        }
                      >
                        <div className="w-7 h-7 rounded-full bg-base-300 flex items-center justify-center text-[10px] font-bold text-base-content flex-shrink-0 uppercase">
                          {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-base-content truncate">{m.name}</p>
                          <p className="text-[10px] text-base-content/40 uppercase tracking-wider">
                            {m.role.replace(/_/g, " ")}
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
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => void createTask()}
              disabled={creating || !title.trim()}
            >
              {creating && <span className="loading loading-spinner loading-sm" />}
              Create Task
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setShowModal(false)} />
      </dialog>
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={(updated) => {
            setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
          }}
        />
      )}
    </>
  );
}

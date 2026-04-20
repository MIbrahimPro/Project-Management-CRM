"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Circle, Clock, Loader2, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type Assignee = {
  userId: string;
  user: { id: string; name: string; profilePicUrl: string | null; role: string };
};

type Task = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  assignees: Assignee[];
  createdBy: { id: string; name: string };
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; badge: string }> = {
  TODO: { icon: <Circle className="w-4 h-4 text-base-content/40" />, label: "To Do", badge: "badge-ghost" },
  IN_PROGRESS: { icon: <Loader2 className="w-4 h-4 text-info animate-spin" />, label: "In Progress", badge: "badge-info" },
  IN_REVIEW: { icon: <Clock className="w-4 h-4 text-warning" />, label: "In Review", badge: "badge-warning" },
  DONE: { icon: <CheckCircle2 className="w-4 h-4 text-success" />, label: "Done", badge: "badge-success" },
  CANCELLED: { icon: <X className="w-4 h-4 text-error" />, label: "Cancelled", badge: "badge-error" },
};

export default function ProjectTasksPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params?.id ?? "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    void loadTasks();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTasks() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`);
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as { data: Task[] };
      setTasks(json.data ?? []);
    } catch {
      toast.error("Failed to load tasks", { style: TOAST_ERROR_STYLE });
    } finally {
      setLoading(false);
    }
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      const json = (await res.json()) as { data: Task };
      setTasks((prev) => [json.data, ...prev]);
      setNewTitle("");
      setShowCreate(false);
      toast.success("Task created", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setCreating(false);
    }
  }

  // Split into current (active) vs past (done/cancelled)
  const currentTasks = tasks.filter((t) => !["DONE", "CANCELLED"].includes(t.status));
  const pastTasks = tasks.filter((t) => ["DONE", "CANCELLED"].includes(t.status));

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  function TaskRow({ task }: { task: Task }) {
    const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO;
    return (
      <button
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-base-200 border border-base-300 hover:bg-base-300 transition-colors text-left group"
        onClick={() => router.push(`/projects/${projectId}/tasks/${task.id}`)}
      >
        <div className="flex-shrink-0">{statusCfg.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-base-content truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`badge badge-xs ${statusCfg.badge}`}>{statusCfg.label}</span>
            <span className="text-xs text-base-content/40">
              {dayjs(task.createdAt).fromNow()}
            </span>
          </div>
        </div>
        {/* Assignee avatars */}
        <div className="flex -space-x-2 flex-shrink-0">
          {task.assignees.slice(0, 4).map((a) => (
            <div
              key={a.userId}
              className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary border-2 border-base-200 group-hover:border-base-300"
              title={a.user.name}
            >
              {a.user.name[0]?.toUpperCase()}
            </div>
          ))}
          {task.assignees.length > 4 && (
            <div className="w-7 h-7 rounded-full bg-base-300 flex items-center justify-center text-xs text-base-content/50 border-2 border-base-200">
              +{task.assignees.length - 4}
            </div>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-base-content">Tasks</h1>
        <button
          className="btn btn-primary btn-sm gap-1"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card bg-base-200 border border-primary/30 shadow-sm">
          <div className="card-body gap-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">New Task</h3>
              <button
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => setShowCreate(false)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              className="input input-bordered bg-base-100 w-full"
              placeholder="Task title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) void createTask();
              }}
              autoFocus
            />
            <p className="text-xs text-base-content/50">
              Admins and managers are added by default. You can add more assignees after creation.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => void createTask()}
                disabled={creating || !newTitle.trim()}
              >
                {creating && <span className="loading loading-spinner loading-xs" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Current Tasks */}
      {currentTasks.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">
            Current Tasks
          </h2>
          <div className="space-y-1.5">
            {currentTasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        </div>
      )}

      {/* Past Tasks */}
      {pastTasks.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">
            Completed
          </h2>
          <div className="space-y-1.5">
            {pastTasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="text-center py-16 text-base-content/40">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-lg">No tasks yet</p>
          <button
            className="btn btn-primary btn-sm mt-4"
            onClick={() => setShowCreate(true)}
          >
            Create the first task
          </button>
        </div>
      )}
    </div>
  );
}

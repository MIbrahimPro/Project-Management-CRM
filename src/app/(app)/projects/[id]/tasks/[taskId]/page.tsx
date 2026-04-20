"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Clock, Loader2, MessageSquare, PlayCircle, Save, User, Video, X } from "lucide-react";
import toast from "react-hot-toast";
import MeetingRecordingList from "@/components/meetings/MeetingRecordingList";
import type { StandaloneEditorHandle } from "@/components/documents/StandaloneEditor";

const StandaloneEditor = dynamic(() => import("@/components/documents/StandaloneEditor"), { ssr: false });

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";

const STATUS_BADGE: Record<TaskStatus, string> = {
  TODO: "badge-neutral",
  IN_PROGRESS: "badge-warning",
  IN_REVIEW: "badge-info",
  DONE: "badge-success",
  CANCELLED: "badge-error",
};

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  TODO: <Circle className="w-4 h-4 text-base-content/40" />,
  IN_PROGRESS: <Loader2 className="w-4 h-4 text-warning" />,
  IN_REVIEW: <Clock className="w-4 h-4 text-info" />,
  DONE: <CheckCircle2 className="w-4 h-4 text-success" />,
  CANCELLED: <Circle className="w-4 h-4 text-error" />,
};

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"];

type TaskDetail = {
  id: string;
  title: string;
  status: TaskStatus;
  description: string | null;
  createdAt: string;
  project: { id: string; title: string } | null;
  createdBy: { id: string; name: string } | null;
  assignees: { user: { id: string; name: string; profilePicUrl: string | null } }[];
};

export default function ProjectTaskDetailPage() {
  const params = useParams<{ id: string; taskId: string }>();
  const router = useRouter();
  const projectId = params?.id ?? "";
  const taskId = params?.taskId ?? "";

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);
  const [startingMeeting, setStartingMeeting] = useState(false);
  const [recordingsOpen, setRecordingsOpen] = useState(false);

  const descRef = useRef<StandaloneEditorHandle>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedDescRef = useRef<string | null>(null);

  useEffect(() => {
    if (!taskId) return;
    void loadTask();
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTask() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) {
        toast.error("Task not found", { style: TOAST_ERROR_STYLE });
        router.push(`/projects/${projectId}/tasks`);
        return;
      }
      const json = (await res.json()) as { data?: TaskDetail };
      if (!json.data) {
        router.push(`/projects/${projectId}/tasks`);
        return;
      }
      setTask(json.data);
      setStatus(json.data.status);
      savedDescRef.current = json.data.description ?? null;
    } catch {
      toast.error("Failed to load task", { style: TOAST_ERROR_STYLE });
    } finally {
      setLoading(false);
    }
  }

  async function saveStatus(newStatus: TaskStatus) {
    if (!task || newStatus === task.status) return;
    setSavingStatus(true);
    setStatus(newStatus);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      setTask((prev) => prev ? { ...prev, status: newStatus } : prev);
      toast.success("Status updated", { style: TOAST_STYLE });
    } catch {
      setStatus(task.status);
      toast.error("Failed to update status", { style: TOAST_ERROR_STYLE });
    } finally {
      setSavingStatus(false);
    }
  }

  async function saveDescription(description: string, silent = false) {
    if (description === savedDescRef.current) return;
    setSavingDesc(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) throw new Error("Failed");
      savedDescRef.current = description;
      setTask((prev) => prev ? { ...prev, description } : prev);
      if (!silent) toast.success("Description saved", { style: TOAST_STYLE });
    } catch {
      if (!silent) toast.error("Failed to save description", { style: TOAST_ERROR_STYLE });
    } finally {
      setSavingDesc(false);
    }
  }

  async function startMeeting() {
    if (!task) return;

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
          title: `Task: ${task.title}`,
          taskId: task.id,
        }),
      });
      const data = (await res.json()) as { data?: { meetingId: string }; error?: string };

      if (!res.ok || !data.data) {
        throw new Error(data.error || "Failed to start meeting");
      }

      meetingTab.location.href = `/meetings/${data.data.meetingId}`;
      toast.success("Meeting started", { style: TOAST_STYLE });
    } catch (error) {
      meetingTab.close();
      toast.error(error instanceof Error ? error.message : "Failed to start meeting", {
        style: TOAST_ERROR_STYLE,
      });
    } finally {
      setStartingMeeting(false);
    }
  }

  function handleDescChange(json: string) {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void saveDescription(json, true);
    }, 1500);
  }

  function handleManualSave() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (!descRef.current) return;
    void saveDescription(descRef.current.getContent(), false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!task) return null;

  return (
    <>
      <div className="space-y-5">
      {/* Breadcrumb back */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-sm gap-1"
            onClick={() => router.push(`/projects/${projectId}/tasks`)}
          >
            <ArrowLeft className="w-4 h-4" />
            Tasks
          </button>
          <span className="text-base-content/20">/</span>
          <span className="text-sm text-base-content/60 truncate max-w-[300px]">{task.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-sm gap-2"
            onClick={() => setRecordingsOpen(true)}
          >
            <PlayCircle className="w-4 h-4" />
            Recordings
          </button>
          <button
            className="btn btn-primary btn-sm gap-2"
            onClick={() => void startMeeting()}
            disabled={startingMeeting}
          >
            {startingMeeting ? <span className="loading loading-spinner loading-xs" /> : <Video className="w-4 h-4" />}
            Start Meeting
          </button>
          <Link href={`/projects/${projectId}/chat`} className="btn btn-ghost btn-sm gap-1">
            <MessageSquare className="w-4 h-4" />
            Team Chat
          </Link>
        </div>
      </div>

      {/* Title + status badge */}
      <div>
        <div className="flex items-start gap-3">
          <div className="mt-1">{STATUS_ICONS[status]}</div>
          <h1 className="text-xl font-semibold text-base-content flex-1">{task.title}</h1>
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Status */}
        <div className="bg-base-200 rounded-xl p-3 space-y-1.5">
          <p className="text-xs text-base-content/40 uppercase tracking-wide">Status</p>
          <select
            className="select select-bordered select-sm w-full bg-base-100"
            value={status}
            onChange={(e) => void saveStatus(e.target.value as TaskStatus)}
            disabled={savingStatus}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        {/* Created */}
        <div className="bg-base-200 rounded-xl p-3 space-y-1.5">
          <p className="text-xs text-base-content/40 uppercase tracking-wide">Created</p>
          <div className="flex items-center gap-1.5 text-sm text-base-content/70">
            <Clock className="w-3.5 h-3.5 text-base-content/40" />
            {new Date(task.createdAt).toLocaleDateString()}
          </div>
        </div>

        {/* Created by */}
        <div className="bg-base-200 rounded-xl p-3 space-y-1.5">
          <p className="text-xs text-base-content/40 uppercase tracking-wide">Created By</p>
          <div className="flex items-center gap-1.5 text-sm text-base-content/70">
            <User className="w-3.5 h-3.5 text-base-content/40" />
            {task.createdBy?.name ?? "—"}
          </div>
        </div>
      </div>

      {/* Assignees */}
      {task.assignees.length > 0 && (
        <div className="bg-base-200 rounded-xl p-3 space-y-2">
          <p className="text-xs text-base-content/40 uppercase tracking-wide">Assignees</p>
          <div className="flex flex-wrap gap-2">
            {task.assignees.map((a) => (
              <div
                key={a.user.id}
                className="flex items-center gap-1.5 bg-base-100 rounded-full px-2.5 py-1"
              >
                <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {a.user.name[0]}
                </div>
                <span className="text-xs text-base-content">{a.user.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-base-content">Description</p>
          <button
            className="btn btn-ghost btn-xs gap-1"
            onClick={handleManualSave}
            disabled={savingDesc}
          >
            {savingDesc ? <span className="loading loading-spinner loading-xs" /> : <Save className="w-3 h-3" />}
            Save
          </button>
        </div>
        <div className="bg-base-200 rounded-xl overflow-hidden min-h-[200px]">
          <StandaloneEditor
            ref={descRef}
            initialContent={task.description ?? ""}
            onChange={handleDescChange}
          />
        </div>
      </div>
    </div>
      {recordingsOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl bg-base-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">Task Recordings</h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setRecordingsOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <MeetingRecordingList taskId={taskId} />
          </div>
          <div className="modal-backdrop" onClick={() => setRecordingsOpen(false)} />
        </div>
      )}
    </>
  );
}

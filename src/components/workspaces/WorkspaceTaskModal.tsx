"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Calendar,
  ChevronDown,
  ImagePlus,
  Loader2,
  Save,
  Star,
  Trash2,
  X,
  Video,
  PlayCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import type { WorkspaceTask, WorkspaceMember } from "./types";
import { useWorkspaceSignedUrl } from "./useWorkspaceSignedUrl";
import {
  canArchiveWorkspacePost,
  canTransitionWorkspacePost,
  getAllowedWorkspacePostTargets,
  getPrimaryWorkspacePostTarget,
  workspacePostMenuLabel,
} from "@/lib/workspace-post-status";
import { UserAvatar } from "@/components/ui/UserAvatar";
import MeetingRecordingList from "@/components/meetings/MeetingRecordingList";

const StandaloneEditor = dynamic(() => import("@/components/documents/StandaloneEditor"), {
  ssr: false,
  loading: () => <div className="h-48 bg-base-100 rounded-lg animate-pulse" />,
});

const STATUSES: { value: WorkspaceTask["status"]; label: string; badge: string }[] = [
  { value: "IDEA", label: "Idea", badge: "badge-neutral" },
  { value: "IN_PROGRESS", label: "In progress", badge: "badge-warning" },
  { value: "IN_REVIEW", label: "In review", badge: "badge-info" },
  { value: "APPROVED", label: "Approved", badge: "badge-success" },
  { value: "PUBLISHED", label: "Published", badge: "badge-primary" },
  { value: "ARCHIVED", label: "Archived", badge: "badge-ghost" },
];

type DescSaveState = "idle" | "saving" | "saved" | "error";

interface WorkspaceTaskModalProps {
  task: WorkspaceTask;
  members: WorkspaceMember[];
  workspaceId: string;
  userRole: string;
  onClose: () => void;
  onUpdate: (taskId: string, data: Partial<WorkspaceTask>) => void;
  onDelete: (taskId: string) => void;
  presenceMap?: Record<string, string>;
}

function MediaThumb({ path, label }: { path: string; label: string }) {
  const url = useWorkspaceSignedUrl(path);
  const isImg = /\.(png|jpe?g|gif|webp)$/i.test(path);
  if (!url) {
    return <div className="w-full aspect-video bg-base-300 rounded-lg animate-pulse" />;
  }
  if (isImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={label} className="w-full aspect-video object-cover rounded-lg" />
    );
  }
  return (
    <video src={url} className="w-full aspect-video object-cover rounded-lg bg-base-300" muted playsInline controls />
  );
}

export function WorkspaceTaskModal({
  task,
  members,
  workspaceId,
  userRole,
  onClose,
  onUpdate,
  onDelete,
  presenceMap,
}: WorkspaceTaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState(task.status);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assigneeIds);
  const [postedAt, setPostedAt] = useState(task.postedAt ? task.postedAt.split("T")[0] : "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [descSave, setDescSave] = useState<DescSaveState>("idle");
  const [statusBusy, setStatusBusy] = useState(false);
  const [startingMeeting, setStartingMeeting] = useState(false);
  const [recordingsOpen, setRecordingsOpen] = useState(false);

  const descRef = useRef<{ getContent: () => string } | null>(null);
  const descTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentDescRef = useRef<string>(task.description ?? "");

  useEffect(() => {
    setTitle(task.title);
    setStatus(task.status);
    setAssigneeIds(task.assigneeIds);
    setPostedAt(task.postedAt ? task.postedAt.split("T")[0] : "");
  }, [task]);
  
  useEffect(() => {
    return () => {
      if (descTimerRef.current) clearTimeout(descTimerRef.current);
    };
  }, []);

  const saveMeta = useCallback(async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          postedAt: postedAt || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { data: Partial<WorkspaceTask> };
      onUpdate(task.id, data.data);
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [title, postedAt, workspaceId, task.id, saving, onUpdate]);

  async function scheduleDescriptionSave(json: string) {
    if (json === lastSentDescRef.current) return;
    setDescSave("saving");
    if (descTimerRef.current) clearTimeout(descTimerRef.current);
    descTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: json }),
        });
        if (!res.ok) throw new Error();
        lastSentDescRef.current = json;
        onUpdate(task.id, { description: json });
        setDescSave("saved");
        setTimeout(() => setDescSave("idle"), 2000);
      } catch {
        setDescSave("error");
      }
    }, 1500);
  }

  async function uploadMedia(file: File) {
    if (uploading) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { data: Partial<WorkspaceTask> };
      onUpdate(task.id, data.data);
      toast.success("Uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(path: string) {
    if (!confirm("Remove this attachment?")) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}/attachments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { data: Partial<WorkspaceTask> };
      onUpdate(task.id, data.data);
    } catch {
      toast.error("Failed to remove");
    }
  }

  async function setThumbnail(path: string | null) {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailPath: path }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { data: Partial<WorkspaceTask> };
      onUpdate(task.id, data.data);
    } catch {
      toast.error("Failed to set cover");
    }
  }

  async function toggleAssignee(userId: string) {
    const nextIds = assigneeIds.includes(userId)
      ? assigneeIds.filter((id) => id !== userId)
      : [...assigneeIds, userId];
    
    setAssigneeIds(nextIds);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeIds: nextIds }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { data: Partial<WorkspaceTask> };
      onUpdate(task.id, data.data);
    } catch {
      toast.error("Could not save assignees");
    }
  }

  async function applyStatus(next: WorkspaceTask["status"]) {
    if (next === status || statusBusy) return;
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const j = (await res.json()) as { data?: Partial<WorkspaceTask>; error?: string };
      if (!res.ok) {
        toast.error(j.error ?? "Could not update status");
        return;
      }
      if (j.data?.status) setStatus(j.data.status);
      if (j.data) onUpdate(task.id, j.data);
    } finally {
      setStatusBusy(false);
    }
  }

  async function startMeeting() {
    const meetingTab = window.open("about:blank", "_blank");
    if (!meetingTab) {
      toast.error("Please allow pop-ups to open meetings");
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
          workspaceId: workspaceId 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      meetingTab.location.href = `/meetings/${data.data.meetingId}`;
    } catch (e: any) {
      meetingTab.close();
      toast.error(e.message);
    } finally {
      setStartingMeeting(false);
    }
  }

  async function deleteTask() {
    if (!confirm("Are you sure you want to delete this post forever?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      onDelete(task.id);
      onClose();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  const currentStatus = STATUSES.find((s) => s.value === status)!;
  const primaryTarget = getPrimaryWorkspacePostTarget(userRole, status);
  const allowedTargets = getAllowedWorkspacePostTargets(userRole, status);
  const showArchiveBtn = canArchiveWorkspacePost(userRole, status) && !!task.postedAt;
  const menuTargets = allowedTargets.filter((t) => t !== primaryTarget && t !== "ARCHIVED");

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-200 max-w-3xl w-full max-h-[92vh] flex flex-col p-0 overflow-hidden border border-base-300">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-base-300">
          <input
            className="input input-ghost text-lg font-semibold text-base-content flex-1 px-0 focus:outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
          />
          <button type="button" className="btn btn-ghost btn-sm btn-circle flex-shrink-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`badge badge-lg ${currentStatus.badge}`}>{currentStatus.label}</span>

            {primaryTarget && (
              <div className="join">
                <button
                  type="button"
                  className="btn btn-primary btn-sm join-item gap-1 min-h-[2.25rem] border-0"
                  disabled={statusBusy}
                  onClick={() => void applyStatus(primaryTarget)}
                >
                  {statusBusy && <span className="loading loading-spinner loading-xs" />}
                  {workspacePostMenuLabel(primaryTarget)}
                </button>
                {menuTargets.length > 0 && (
                  <div className="dropdown dropdown-end join-item">
                    <label tabIndex={0} className="btn btn-primary btn-sm px-2 min-h-[2.25rem] border-0">
                      <ChevronDown className="w-4 h-4" />
                    </label>
                    <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 mt-1 border border-base-300">
                      {menuTargets.map((t) => (
                        <li key={t}>
                          <button onClick={() => void applyStatus(t)}>{workspacePostMenuLabel(t)}</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {showArchiveBtn && (
              <button className="btn btn-ghost btn-sm gap-1" onClick={() => applyStatus("ARCHIVED")}>
                Archive
              </button>
            )}

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <button className="btn btn-sm btn-ghost gap-2" onClick={() => setRecordingsOpen(true)}>
                <PlayCircle className="w-4 h-4" />
                History
              </button>
              <button 
                className="btn btn-sm btn-primary gap-2"
                onClick={startMeeting}
                disabled={startingMeeting}
              >
                {startingMeeting ? <span className="loading loading-spinner loading-xs" /> : <Video className="w-4 h-4" />}
                Discuss
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-base-content/50 uppercase font-semibold tracking-widest">Description</p>
                {descSave !== "idle" && (
                  <span className={`text-[10px] uppercase font-bold ${descSave === "saving" ? "text-primary animate-pulse" : descSave === "saved" ? "text-success" : "text-error"}`}>
                    {descSave === "saving" ? "Saving..." : descSave === "saved" ? "Saved" : "Error"}
                  </span>
                )}
              </div>
              <StandaloneEditor
                key={task.id}
                ref={descRef}
                initialContent={task.description ?? ""}
                onChange={(json) => scheduleDescriptionSave(json)}
              />
            </div>

            <div>
              <p className="text-xs text-base-content/50 uppercase font-semibold tracking-widest mb-2">Media</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <label className="btn btn-sm btn-outline gap-1 cursor-pointer border-base-300 hover:bg-base-300">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  Add media
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,video/*"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void uploadMedia(f);
                    }}
                  />
                </label>
              </div>
              {task.attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {task.attachments.map((path) => (
                    <div key={path} className="relative rounded-xl border border-base-300 overflow-hidden bg-base-100 group">
                      <MediaThumb path={path} label="attachment" />
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button
                          type="button"
                          className={`btn btn-xs btn-circle ${task.thumbnailPath === path ? "btn-primary" : "btn-ghost bg-base-100/90"}`}
                          title="Use as cover"
                          onClick={() => void setThumbnail(task.thumbnailPath === path ? null : path)}
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-circle btn-ghost bg-base-100/90 text-error"
                          title="Remove"
                          onClick={() => void removeAttachment(path)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-base-content/40">No media yet.</p>
              )}
            </div>

            <div>
              <p className="text-xs text-base-content/50 uppercase font-semibold tracking-widest mb-2">Assignees</p>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const isAssigned = assigneeIds.includes(m.userId);
                  const isOnline = presenceMap ? presenceMap[m.userId] === "online" : false;
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        isAssigned ? "bg-primary/15 border-primary/40 text-primary" : "bg-base-300 border-base-300 text-base-content/70 hover:border-primary/30"
                      }`}
                      onClick={() => toggleAssignee(m.userId)}
                    >
                      <UserAvatar user={m.user} size={24} showPresence={!!presenceMap} isOnline={isOnline} />
                      {m.user.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs text-base-content/50 uppercase font-semibold tracking-widest mb-2">Posted Date</p>
              <input
                type="date"
                className="input input-bordered input-sm w-full max-w-xs bg-base-100"
                value={postedAt}
                onChange={(e) => setPostedAt(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="modal-action border-t border-base-300 px-5 py-4 mt-0 bg-base-200/95">
          <button type="button" className="btn btn-ghost btn-sm text-error gap-1" onClick={deleteTask} disabled={deleting}>
            {deleting ? <span className="loading loading-spinner loading-xs" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </button>
          <div className="flex-1" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary btn-sm gap-1" onClick={saveMeta} disabled={saving || !title.trim()}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        </div>
      </div>

      {recordingsOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl bg-base-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Task Recordings</h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setRecordingsOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <MeetingRecordingList taskId={task.id} />
          </div>
          <div className="modal-backdrop" onClick={() => setRecordingsOpen(false)} />
        </div>
      )}
    </dialog>
  );
}

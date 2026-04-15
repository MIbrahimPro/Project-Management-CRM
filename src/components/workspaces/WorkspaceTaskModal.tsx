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
  /** From `x-user-role` — drives allowed status transitions */
  userRole: string;
  onClose: () => void;
  onUpdate: (taskId: string, data: Partial<WorkspaceTask>) => void;
  onDelete: (taskId: string) => void;
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

/**
 * Post editor: BlockNote description with debounced save, optional posted date, multi-media with cover selection.
 */
export function WorkspaceTaskModal({
  task,
  members,
  workspaceId,
  userRole,
  onClose,
  onUpdate,
  onDelete,
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

  const descRef = useRef<{ getContent: () => string } | null>(null);
  const descTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentDescRef = useRef<string>(task.description ?? "");

  useEffect(() => {
    setTitle(task.title);
    setStatus(task.status);
    setAssigneeIds(task.assigneeIds);
    setPostedAt(task.postedAt ? task.postedAt.split("T")[0] : "");
    lastSentDescRef.current = task.description ?? "";
  }, [task.id, task.updatedAt, task.title, task.status, task.assigneeIds, task.postedAt, task.description]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveDescription = useCallback(
    async (json: string) => {
      if (json === lastSentDescRef.current) {
        setDescSave("idle");
        return;
      }
      setDescSave("saving");
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: json }),
        });
        if (!res.ok) throw new Error("save");
        const data = (await res.json()) as { data: Partial<WorkspaceTask> };
        lastSentDescRef.current = json;
        onUpdate(task.id, data.data);
        setDescSave("saved");
        setTimeout(() => setDescSave("idle"), 2000);
      } catch {
        setDescSave("error");
      }
    },
    [task.id, workspaceId, onUpdate]
  );

  const scheduleDescriptionSave = useCallback(
    (json: string) => {
      if (descTimerRef.current) clearTimeout(descTimerRef.current);
      setDescSave("saving");
      descTimerRef.current = setTimeout(() => {
        void saveDescription(json);
      }, 1200);
    },
    [saveDescription]
  );

  useEffect(() => {
    return () => {
      if (descTimerRef.current) clearTimeout(descTimerRef.current);
      const latest = descRef.current?.getContent();
      if (latest !== undefined && latest !== lastSentDescRef.current) {
        void fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: latest }),
        }).catch(() => undefined);
      }
    };
  }, [task.id, workspaceId]);

  async function saveMeta() {
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          assigneeIds,
          postedAt: postedAt ? new Date(postedAt).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { data: Partial<WorkspaceTask> };
      onUpdate(task.id, data.data);
      toast.success("Details saved", {
        style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" },
      });
    } catch {
      toast.error("Could not save", {
        style: { background: "hsl(var(--b2))", color: "hsl(var(--er))" },
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask() {
    if (!confirm("Delete this post?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}`, { method: "DELETE" });
      onDelete(task.id);
      onClose();
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  }

  async function uploadMedia(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}/media`, {
        method: "POST",
        body: fd,
      });
      const j = (await res.json()) as {
        data?: { attachments: string[]; thumbnailPath: string | null };
      };
      if (!res.ok) throw new Error("upload");
      if (j.data) {
        onUpdate(task.id, {
          attachments: j.data.attachments,
          thumbnailPath: j.data.thumbnailPath,
        });
      }
    } catch {
      // silent
    } finally {
      setUploading(false);
    }
  }

  async function setThumbnail(path: string | null) {
    const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thumbnailPath: path }),
    });
    const data = (await res.json()) as { data: Partial<WorkspaceTask> };
    if (res.ok) onUpdate(task.id, data.data);
  }

  async function removeAttachment(path: string) {
    const next = task.attachments.filter((p) => p !== path);
    const nextThumb = task.thumbnailPath === path ? null : task.thumbnailPath;
    const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachments: next, thumbnailPath: nextThumb }),
    });
    const data = (await res.json()) as { data: Partial<WorkspaceTask> };
    if (res.ok) onUpdate(task.id, data.data);
  }

  function toggleAssignee(userId: string) {
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
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
        toast.error(j.error ?? "Could not update status", {
          style: { background: "hsl(var(--b2))", color: "hsl(var(--er))" },
        });
        return;
      }
      if (j.data?.status) setStatus(j.data.status);
      if (j.data) onUpdate(task.id, j.data);
    } finally {
      setStatusBusy(false);
    }
  }

  function confirmArchive() {
    if (!canArchiveWorkspacePost(userRole, status)) return;
    if (
      !confirm(
        "Archive this post? It will move to Past posts (archived). You can change it back later if you have access."
      )
    ) {
      return;
    }
    void applyStatus("ARCHIVED");
  }

  const currentStatus = STATUSES.find((s) => s.value === status)!;
  const primaryTarget = getPrimaryWorkspacePostTarget(userRole, status);
  const allowedTargets = getAllowedWorkspacePostTargets(userRole, status);
  const showArchiveBtn = canArchiveWorkspacePost(userRole, status);
  const menuTargets = allowedTargets.filter(
    (t) => t !== primaryTarget && t !== "ARCHIVED"
  );

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
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle flex-shrink-0"
            onClick={onClose}
          >
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
                  {statusBusy ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : null}
                  {workspacePostMenuLabel(primaryTarget)}
                </button>
                {menuTargets.length > 0 && (
                  <div className="dropdown dropdown-end join-item">
                    <label
                      tabIndex={0}
                      className="btn btn-primary btn-sm px-2 min-h-[2.25rem] border-0"
                      title="Other status options"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </label>
                    <ul
                      tabIndex={0}
                      className="dropdown-content menu bg-base-200 border border-base-300 rounded-box w-56 shadow-lg z-[60] p-1 max-h-72 overflow-y-auto"
                    >
                      {menuTargets.map((to) => (
                        <li key={to}>
                          <button
                            type="button"
                            className="text-sm"
                            disabled={statusBusy}
                            onClick={() => void applyStatus(to)}
                          >
                            {workspacePostMenuLabel(to)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!primaryTarget && menuTargets.length > 0 && (
              <div className="dropdown dropdown-end">
                <label
                  tabIndex={0}
                  className="btn btn-sm btn-outline border-base-300 gap-1"
                  title="Change status"
                >
                  Other status…
                  <ChevronDown className="w-4 h-4" />
                </label>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu bg-base-200 border border-base-300 rounded-box w-56 shadow-lg z-[60] p-1 max-h-72 overflow-y-auto"
                >
                  {menuTargets.map((to) => (
                    <li key={to}>
                      <button
                        type="button"
                        className="text-sm"
                        disabled={statusBusy}
                        onClick={() => void applyStatus(to)}
                      >
                        {workspacePostMenuLabel(to)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {showArchiveBtn && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square text-base-content/70 hover:bg-base-300 hover:text-base-content"
                title="Archive post"
                disabled={statusBusy}
                onClick={confirmArchive}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-2 text-sm text-base-content/70">
              <Calendar className="w-4 h-4 opacity-60" />
              <span>Created {new Date(task.createdAt).toLocaleString()}</span>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <span className="text-base-content/60 whitespace-nowrap">Posted date</span>
              <input
                type="date"
                className="input input-bordered input-sm bg-base-100 max-w-[11rem]"
                value={postedAt}
                onChange={(e) => setPostedAt(e.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-base-content/50 uppercase font-semibold tracking-widest">
                Description
              </p>
              <span className="text-xs text-base-content/40 min-h-[1rem]">
                {descSave === "saving" && (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                  </span>
                )}
                {descSave === "saved" && "Saved"}
                {descSave === "error" && <span className="text-error">Could not save</span>}
              </span>
            </div>
            <div className="bg-base-100 rounded-xl border border-base-300 min-h-[200px] overflow-hidden">
              <StandaloneEditor
                key={task.id}
                ref={descRef}
                initialContent={task.description ?? ""}
                onChange={(json) => scheduleDescriptionSave(json)}
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-base-content/50 uppercase font-semibold tracking-widest mb-2">
              Media
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <label className="btn btn-sm btn-outline gap-1 cursor-pointer border-base-300 hover:bg-base-300">
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImagePlus className="w-4 h-4" />
                )}
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
            {task.attachments.length === 0 ? (
              <p className="text-xs text-base-content/40">No media yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {task.attachments.map((path) => (
                  <div
                    key={path}
                    className="relative rounded-xl border border-base-300 overflow-hidden bg-base-100 group"
                  >
                    <MediaThumb path={path} label="attachment" />
                    <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-90">
                      <button
                        type="button"
                        className={`btn btn-xs btn-circle ${
                          task.thumbnailPath === path ? "btn-primary" : "btn-ghost bg-base-100/90"
                        }`}
                        title="Use as cover"
                        onClick={() =>
                          void setThumbnail(task.thumbnailPath === path ? null : path)
                        }
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
            )}
          </div>

          <div>
            <p className="text-xs text-base-content/50 uppercase font-semibold tracking-widest mb-2">
              Assignees
            </p>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const isAssigned = assigneeIds.includes(m.userId);
                return (
                  <button
                    key={m.userId}
                    type="button"
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      isAssigned
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-base-300 border-base-300 text-base-content/70 hover:border-primary/30"
                    }`}
                    onClick={() => toggleAssignee(m.userId)}
                  >
                    <span className="w-4 h-4 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                      {m.user.name[0]}
                    </span>
                    {m.user.name}
                  </button>
                );
              })}
              {members.length === 0 && (
                <p className="text-xs text-base-content/40">No members on this board.</p>
              )}
            </div>
          </div>
        </div>

        <div className="modal-action border-t border-base-300 px-5 py-4 mt-0 bg-base-200/95">
          <button
            type="button"
            className="btn btn-ghost btn-sm text-error gap-1"
            onClick={() => void deleteTask()}
            disabled={deleting}
          >
            {deleting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Delete forever
          </button>
          <div className="flex-1" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm gap-1"
            onClick={() => void saveMeta()}
            disabled={saving || !title.trim()}
          >
            {saving ? <span className="loading loading-spinner loading-xs" /> : <Save className="w-3.5 h-3.5" />}
            Save details
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-base-content/40" onClick={onClose} />
    </dialog>
  );
}

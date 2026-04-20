"use client";

import { useState, useEffect } from "react";
import { X, Calendar, User, Layout, MessageSquare, CheckCircle2, Circle, Trash2, Plus, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { AvatarStack } from "@/components/projects/AvatarStack";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { usePresence } from "@/components/layout/PresenceProvider";
import type { TaskCard, TaskStatus } from "./TaskKanban";

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: "TODO", label: "To Do", color: "badge-neutral" },
  { value: "IN_PROGRESS", label: "In Progress", color: "badge-warning" },
  { value: "IN_REVIEW", label: "In Review", color: "badge-info" },
  { value: "DONE", label: "Done", color: "badge-success" },
  { value: "CANCELLED", label: "Cancelled", color: "badge-error" },
];

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  onUpdate: (updatedTask: any) => void;
}

export function TaskDetailModal({ taskId, onClose, onUpdate }: TaskDetailModalProps) {
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState("");
  const presenceMap = usePresence();

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    fetch(`/api/tasks/${taskId}`)
      .then((r) => r.json())
      .then((d) => {
        setTask(d.data);
        setDescription(d.data.description || "");
      })
      .catch(() => toast.error("Failed to load task details"))
      .finally(() => setLoading(false));
  }, [taskId]);

  async function updateTask(data: any) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error();
      setTask(updated.data);
      onUpdate(updated.data);
      if (data.description !== undefined) setIsEditingDescription(false);
    } catch {
      toast.error("Failed to update task");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !task) {
    return (
      <dialog className="modal modal-open">
        <div className="modal-box bg-base-200 flex items-center justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
        <div className="modal-backdrop bg-black/40" onClick={onClose} />
      </dialog>
    );
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-200 max-w-2xl p-0 overflow-hidden border border-base-300 shadow-2xl">
        {/* Header */}
        <div className="p-6 bg-base-100 border-b border-base-300 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Layout className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-50">
                {task.project?.title || "General Task"}
              </span>
            </div>
            <h3 className="text-xl font-bold text-base-content leading-tight">
              {task.title}
            </h3>
          </div>
          <button className="btn btn-sm btn-circle btn-ghost -mt-1 -mr-1" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-[500px]">
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {/* Status & Meta */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-1">Status</p>
                <div className="dropdown w-full">
                  <div tabIndex={0} role="button" className={`btn btn-sm w-full justify-between ${STATUS_OPTIONS.find(o => o.value === task.status)?.color} bg-opacity-20`}>
                    {STATUS_OPTIONS.find(o => o.value === task.status)?.label}
                    <Clock className="w-3.5 h-3.5 opacity-50" />
                  </div>
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-1 shadow bg-base-200 border border-base-300 rounded-lg w-full mt-1">
                    {STATUS_OPTIONS.map(opt => (
                      <li key={opt.value}>
                        <button 
                          className={`text-sm ${task.status === opt.value ? "active" : ""}`}
                          onClick={() => updateTask({ status: opt.value })}
                        >
                          {opt.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-1">Created</p>
                <div className="btn btn-sm btn-ghost bg-base-100/50 w-full justify-start gap-2 border border-base-300/50 pointer-events-none">
                  <Calendar className="w-3.5 h-3.5 opacity-50" />
                  <span className="text-sm">
                    {new Date(task.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-bold text-base-content/80">Description</h4>
                </div>
                {!isEditingDescription && (
                  <button className="btn btn-ghost btn-xs" onClick={() => setIsEditingDescription(true)}>Edit</button>
                )}
              </div>
              
              {isEditingDescription ? (
                <div className="space-y-2">
                  <textarea
                    className="textarea textarea-bordered bg-base-100 w-full min-h-[120px] text-sm"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button className="btn btn-xs btn-ghost" onClick={() => {
                      setIsEditingDescription(false);
                      setDescription(task.description || "");
                    }}>Cancel</button>
                    <button className="btn btn-xs btn-primary" onClick={() => updateTask({ description })} disabled={saving}>
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className={`p-4 rounded-xl bg-base-100/50 border border-base-300/30 text-sm whitespace-pre-wrap leading-relaxed ${!task.description ? "italic opacity-40" : ""}`}
                  onClick={() => setIsEditingDescription(true)}
                >
                  {task.description || "No description provided. Click to add one..."}
                </div>
              )}
            </div>

            {/* Subtasks (Mock for now or if schema supports it later) */}
            {/* ... */}
          </div>

          {/* Sidebar */}
          <div className="w-full md:w-56 bg-base-300/30 border-t md:border-t-0 md:border-l border-base-300 p-6 space-y-8">
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Assignees</p>
              <div className="space-y-2">
                {task.assignees?.map((a: any) => (
                  <div key={a.user.id} className="flex items-center gap-2">
                    <UserAvatar
                      user={{ name: a.user.name, profilePicUrl: a.user.profilePicUrl }}
                      size={24}
                      showPresence
                      isOnline={presenceMap[a.user.id] === "online"}
                    />
                    <span className="text-xs font-medium truncate">{a.user.name}</span>
                  </div>
                ))}
                {(!task.assignees || task.assignees.length === 0) && (
                  <p className="text-[10px] italic opacity-40">Unassigned</p>
                )}
                <button className="btn btn-xs btn-ghost btn-block gap-1 mt-1 justify-start font-normal opacity-60 hover:opacity-100">
                  <Plus className="w-3 h-3" /> Add Assignee
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Created</p>
              <div className="flex items-center gap-2 text-xs opacity-60">
                <Clock className="w-3.5 h-3.5" />
                {new Date(task.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div className="pt-4 border-t border-base-300">
              <button className="btn btn-xs btn-ghost text-error gap-1 btn-block justify-start font-normal opacity-60 hover:opacity-100">
                <Trash2 className="w-3 h-3" /> Archive Task
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
    </dialog>
  );
}

"use client";

import { useState } from "react";
import { FileText, Pencil, Trash2, X, Check, Clock, Upload, Trash } from "lucide-react";
import toast from "react-hot-toast";

interface ProjectRequest {
  id: string;
  title: string;
  description: string;
  pdfUrl: string | null;
  status: string;
  createdAt: string;
}

interface ProjectRequestCardProps {
  request: ProjectRequest;
  onUpdate: (updated: ProjectRequest) => void;
  onDelete: (id: string) => void;
}

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

export function ProjectRequestCard({ request, onUpdate, onDelete }: ProjectRequestCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(request.title);
  const [editDesc, setEditDesc] = useState(request.description);
  const [editPdf, setEditPdf] = useState<File | null>(null);
  const [deletePdf, setDeletePdf] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isPending = request.status === "PENDING";

  async function handleSave() {
    if (!editTitle.trim() || !editDesc.trim()) {
      toast.error("Title and description are required", { style: TOAST_ERROR_STYLE });
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("id", request.id);
      formData.append("title", editTitle);
      formData.append("description", editDesc);
      if (deletePdf) {
        formData.append("deletePdf", "true");
      }
      if (editPdf) {
        formData.append("pdf", editPdf);
      }

      const res = await fetch("/api/projects/my-requests", {
        method: "PATCH",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onUpdate(data.data);
      setIsEditing(false);
      setEditPdf(null);
      setDeletePdf(false);
      toast.success("Request updated", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this request?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/my-requests?id=${request.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onDelete(request.id);
      toast.success("Request deleted", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setIsDeleting(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (isEditing) {
    return (
      <div className="card bg-base-200 border-2 border-primary/30 shadow-md">
        <div className="card-body p-4 gap-3">
          <div className="form-control gap-1">
            <label className="label py-0">
              <span className="label-text text-xs">Title</span>
            </label>
            <input
              type="text"
              className="input input-sm input-bordered bg-base-100"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="form-control gap-1">
            <label className="label py-0">
              <span className="label-text text-xs">Description</span>
            </label>
            <textarea
              className="textarea textarea-sm textarea-bordered bg-base-100 min-h-20"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              disabled={isSaving}
            />
          </div>

          {/* File Section */}
          <div className="form-control gap-1">
            <label className="label py-0">
              <span className="label-text text-xs">Attachment (PDF/DOCX/MD/TXT)</span>
            </label>
            {/* Show current file */}
            {request.pdfUrl && !deletePdf && !editPdf && (
              <div className="flex items-center gap-2 p-2 bg-base-300/50 rounded-lg">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm flex-1 truncate">Current file attached</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-circle text-error"
                  onClick={() => setDeletePdf(true)}
                  disabled={isSaving}
                  title="Remove file"
                >
                  <Trash className="w-3 h-3" />
                </button>
              </div>
            )}
            {/* Show delete confirmation */}
            {deletePdf && !editPdf && (
              <div className="flex items-center gap-2 p-2 bg-error/10 rounded-lg">
                <span className="text-sm text-error flex-1">File will be removed</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setDeletePdf(false)}
                  disabled={isSaving}
                >
                  Undo
                </button>
              </div>
            )}
            {/* Show new file upload */}
            {editPdf ? (
              <div className="flex items-center gap-2 p-2 bg-base-300 rounded-lg">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm flex-1 truncate">{editPdf.name}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-circle text-error"
                  onClick={() => setEditPdf(null)}
                  disabled={isSaving}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              !deletePdf && (
                <label className="border-2 border-dashed border-base-content/20 rounded-lg p-3 text-center cursor-pointer hover:border-primary/40 transition-colors">
                  <Upload className="w-5 h-5 text-base-content/30 mx-auto mb-1" />
                  <span className="text-sm text-base-content/50">Click to attach file (optional)</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.md,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
                    className="hidden"
                    onChange={(e) => setEditPdf(e.target.files?.[0] ?? null)}
                    disabled={isSaving}
                  />
                </label>
              )
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => {
                setIsEditing(false);
                setEditTitle(request.title);
                setEditDesc(request.description);
                setEditPdf(null);
                setDeletePdf(false);
              }}
              disabled={isSaving}
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
            <button
              className="btn btn-primary btn-xs"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving && <span className="loading loading-spinner loading-xs" />}
              <Check className="w-3 h-3" />
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-200 border border-base-300 shadow-sm hover:shadow-md transition-shadow">
      <div className="card-body p-4 gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base-content line-clamp-1">{request.title}</h3>
            <p className="text-xs text-base-content/50 mt-0.5">
              Requested on {formatDate(request.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isPending ? (
              <>
                <button
                  className="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:text-primary"
                  onClick={() => setIsEditing(true)}
                  title="Edit request"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  className="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:text-error"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  title="Delete request"
                >
                  {isDeleting ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </>
            ) : (
              <span className="badge badge-sm badge-success">Accepted</span>
            )}
          </div>
        </div>

        <p className="text-sm text-base-content/70 line-clamp-3">{request.description}</p>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            {request.pdfUrl && (
              <span className="flex items-center gap-1 text-xs text-primary">
                <FileText className="w-3.5 h-3.5" />
                File attached
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isPending ? (
              <>
                <Clock className="w-3.5 h-3.5 text-warning" />
                <span className="text-xs text-base-content/60">Awaiting review</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-success" />
                <span className="text-xs text-success">Project created</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

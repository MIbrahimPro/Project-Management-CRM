"use client";

import { ImageIcon, Video } from "lucide-react";
import type { WorkspaceTask, WorkspaceMember } from "./types";
import { blockNoteJsonToPlainText } from "@/lib/blocknote-plain-text";
import { useWorkspaceSignedUrl } from "./useWorkspaceSignedUrl";

const STATUS_BADGE: Record<
  WorkspaceTask["status"],
  { label: string; cls: string }
> = {
  IDEA: { label: "Idea", cls: "badge-neutral" },
  IN_PROGRESS: { label: "In progress", cls: "badge-warning" },
  IN_REVIEW: { label: "In review", cls: "badge-info" },
  APPROVED: { label: "Approved", cls: "badge-success" },
  PUBLISHED: { label: "Published", cls: "badge-primary" },
  ARCHIVED: { label: "Archived", cls: "badge-ghost" },
};

function isProbablyImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
}

function isProbablyVideoPath(path: string): boolean {
  return /\.(mp4|webm|mov|m4v)$/i.test(path);
}

function pickDisplayPath(task: WorkspaceTask): string | null {
  if (task.thumbnailPath) return task.thumbnailPath;
  const img = task.attachments.find((p) => isProbablyImagePath(p));
  if (img) return img;
  const vid = task.attachments.find((p) => isProbablyVideoPath(p));
  return vid ?? task.attachments[0] ?? null;
}

function CardMedia({ path }: { path: string }) {
  const signed = useWorkspaceSignedUrl(path);
  const isImg = isProbablyImagePath(path);
  const isVid = isProbablyVideoPath(path);

  if (!signed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-base-300/80 animate-pulse">
        <ImageIcon className="w-10 h-10 text-base-content/20" />
      </div>
    );
  }

  if (isImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={signed} alt="" className="w-full h-full object-cover" />
    );
  }

  if (isVid) {
    return (
      <div className="relative w-full h-full bg-base-300">
        <video src={signed} className="w-full h-full object-cover" muted playsInline preload="metadata" />
        <div className="absolute inset-0 flex items-center justify-center bg-base-content/10 pointer-events-none">
          <Video className="w-10 h-10 text-base-content/80 drop-shadow-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-base-300">
      <ImageIcon className="w-10 h-10 text-base-content/30" />
    </div>
  );
}

export interface WorkspacePostCardProps {
  task: WorkspaceTask;
  members: WorkspaceMember[];
  onClick: () => void;
}

/**
 * Equal-height post card for social media workspace sections.
 */
export function WorkspacePostCard({ task, members, onClick }: WorkspacePostCardProps) {
  const preview = blockNoteJsonToPlainText(task.description);
  const displayPath = pickDisplayPath(task);
  const status = STATUS_BADGE[task.status];

  const assignees = task.assigneeIds
    .map((id) => members.find((m) => m.userId === id)?.user)
    .filter(Boolean);

  return (
    <button
      type="button"
      onClick={onClick}
      className="card bg-base-200 border border-base-300 text-left shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col h-full min-h-[22rem] w-full max-w-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-200"
    >
      <figure className="relative aspect-[16/10] w-full overflow-hidden rounded-t-2xl bg-base-300 shrink-0 border-b border-base-300">
        {displayPath ? (
          <CardMedia path={displayPath} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-base-content/15" />
          </div>
        )}
        <span className={`badge badge-sm absolute top-2 right-2 ${status.cls} shadow-sm`}>
          {status.label}
        </span>
      </figure>

      <div className="card-body p-4 flex flex-col flex-1 gap-2">
        <h3 className="card-title text-base text-base-content line-clamp-2 min-h-[2.5rem] leading-snug">
          {task.title}
        </h3>
        <p className="text-sm text-base-content/60 line-clamp-3 flex-1 leading-relaxed">
          {preview || "No description yet."}
        </p>

        <div className="flex items-center justify-between gap-2 pt-1 mt-auto border-t border-base-300">
          <div className="flex -space-x-1.5 min-w-0">
            {assignees.slice(0, 4).map((u) =>
              u ? (
                <div
                  key={u.id}
                  className="w-7 h-7 rounded-full bg-primary/25 border-2 border-base-200 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0"
                  title={u.name}
                >
                  {u.name[0]}
                </div>
              ) : null
            )}
            {assignees.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-base-300 border-2 border-base-200 flex items-center justify-center text-xs text-base-content/60 flex-shrink-0">
                +{assignees.length - 4}
              </div>
            )}
            {assignees.length === 0 && (
              <span className="text-xs text-base-content/40">Unassigned</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-base-content/45">
          <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
          {task.postedAt && (
            <span className="text-primary/80">Posted {new Date(task.postedAt).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    </button>
  );
}

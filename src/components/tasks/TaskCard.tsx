"use client";
import { Clock } from "lucide-react";
import { AvatarStack } from "@/components/projects/AvatarStack";

const STATUS_BADGE: Record<string, string> = {
  TODO: "badge-neutral",
  IN_PROGRESS: "badge-warning",
  IN_REVIEW: "badge-info",
  DONE: "badge-success",
  CANCELLED: "badge-error",
};

export function TaskCard({ 
  task, 
  onClick, 
  presenceMap 
}: { 
  task: any; 
  onClick: () => void; 
  presenceMap?: Record<string, string> 
}) {
  const statusCls = STATUS_BADGE[task.status] || "badge-ghost";
  
  return (
    <button
      type="button"
      onClick={onClick}
      className="card bg-base-200 border border-base-300 text-left shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col h-full min-h-[140px] w-full max-w-none p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`badge badge-xs uppercase tracking-tighter font-bold ${statusCls}`}>
          {task.status.replace("_", " ")}
        </span>
        {task.dueDate && (
          <span className="text-[10px] text-base-content/40 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>

      <h3 className="text-base font-semibold text-base-content line-clamp-2 mb-1 leading-snug">
        {task.title}
      </h3>
      
      {task.project && (
        <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-3 opacity-80">
          {task.project.title}
        </p>
      )}

      <div className="mt-auto pt-3 border-t border-base-300/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <AvatarStack 
            users={task.assignees?.map((a: any) => a.user) ?? []}
            presenceMap={presenceMap}
            size="sm"
          />
        </div>
        <span className="text-[9px] text-base-content/30 whitespace-nowrap">
          {new Date(task.createdAt).toLocaleDateString()}
        </span>
      </div>
    </button>
  );
}

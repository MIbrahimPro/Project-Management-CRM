"use client";
import { Clock, ChevronRight } from "lucide-react";
import { AvatarStack } from "@/components/projects/AvatarStack";
import type { TaskStatus } from "./TaskKanban";

const STATUS_STYLE: Record<TaskStatus, string> = {
  TODO: "bg-base-300 text-base-content",
  IN_PROGRESS: "bg-warning/20 text-warning",
  IN_REVIEW: "bg-info/20 text-info",
  DONE: "bg-success/20 text-success",
  CANCELLED: "bg-error/20 text-error",
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
  const statusCls = STATUS_STYLE[task.status as TaskStatus] || "bg-base-200";
  
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative card bg-base-100/40 backdrop-blur-md border border-base-300/50 text-left shadow-sm hover:border-primary/50 hover:bg-base-100/80 hover:shadow-xl transition-all duration-300 flex flex-col h-full min-h-[160px] w-full p-5 focus:outline-none ring-offset-base-100 focus-visible:ring-2 focus-visible:ring-primary overflow-hidden"
    >
      {/* Subtle Glow Effect */}
      <div className="absolute -inset-x-20 -top-20 h-40 w-40 bg-primary/5 blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

      <div className="flex items-start justify-between gap-3 mb-3 relative z-10">
        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest ${statusCls}`}>
          {task.status.replace("_", " ")}
        </span>
      </div>

      <h3 className="text-[15px] font-bold text-base-content line-clamp-2 mb-2 leading-relaxed group-hover:text-primary transition-colors relative z-10">
        {task.title}
      </h3>
      
      {task.project && (
        <div className="flex items-center gap-1.5 mb-4 relative z-10">
           <div className="w-1 h-3 rounded-full bg-primary/30" />
           <p className="text-[10px] text-base-content/50 font-bold uppercase tracking-widest truncate">
             {task.project.title}
           </p>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-base-300/30 flex items-center justify-between gap-2 relative z-10">
        <AvatarStack
          users={(task.assignees ?? []).slice(0, 3).map((a: any) => a.user)}
          overflow={Math.max(0, (task.assignees?.length ?? 0) - 3)}
          presenceMap={presenceMap}
        />
        <div className="flex items-center gap-1 text-[10px] text-base-content/30 group-hover:text-primary/60 transition-colors">
          <span>Details</span>
          <ChevronRight className="w-3 h-3 translate-x-0 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </button>
  );
}

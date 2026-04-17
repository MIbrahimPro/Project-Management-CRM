"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { AvatarStack } from "@/components/projects/AvatarStack";
import { usePresence } from "@/components/layout/PresenceProvider";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";

export type TaskCard = {
  id: string;
  title: string;
  status: TaskStatus;
  project: { id: string; title: string } | null;
  assignees: { user: { id: string; name: string; profilePicUrl: string | null } }[];
};

const COLUMNS: { id: TaskStatus; label: string; badge: string }[] = [
  { id: "TODO", label: "To Do", badge: "badge-neutral" },
  { id: "IN_PROGRESS", label: "In Progress", badge: "badge-warning" },
  { id: "IN_REVIEW", label: "In Review", badge: "badge-info" },
  { id: "DONE", label: "Done", badge: "badge-success" },
  { id: "CANCELLED", label: "Cancelled", badge: "badge-error" },
];

function KanbanCol({
  col,
  tasks,
  onTaskClick,
}: {
  col: typeof COLUMNS[number];
  tasks: TaskCard[];
  onTaskClick: (task: TaskCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[220px] w-[220px] rounded-xl border transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : "border-base-300 bg-base-200"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-base-300">
        <span className={`badge badge-sm ${col.badge}`}>{tasks.length}</span>
        <span className="text-sm font-semibold text-base-content">{col.label}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
        {tasks.map((t) => (
          <DraggableTaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} />
        ))}
      </div>
    </div>
  );
}

function DraggableTaskCard({
  task,
  onClick,
  overlay = false,
}: {
  task: TaskCard;
  onClick: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const presenceMap = usePresence();
  return (
    <div
      ref={setNodeRef}
      className={`card bg-base-100 border border-base-300 shadow-sm hover:border-primary/40 transition-colors cursor-pointer ${
        isDragging && !overlay ? "opacity-30" : ""
      } ${overlay ? "rotate-1 shadow-xl" : ""}`}
    >
      <div className="card-body p-3 gap-1.5">
        <div className="flex items-start gap-2">
          <button
            {...listeners}
            {...attributes}
            className="text-base-content/20 hover:text-base-content/60 flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button className="flex-1 text-left" onClick={onClick}>
            <p className="text-sm font-medium text-base-content line-clamp-2">{task.title}</p>
          </button>
        </div>
        {task.project && (
          <p className="text-xs text-base-content/40 truncate pl-5">{task.project.title}</p>
        )}
        {task.assignees.length > 0 && (
          <div className="pl-5">
            <AvatarStack 
              users={task.assignees.slice(0, 3).map(a => a.user)}
              overflow={Math.max(0, task.assignees.length - 3)}
              presenceMap={presenceMap}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface TaskKanbanProps {
  tasks: TaskCard[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onTaskClick: (task: TaskCard) => void;
}

export function TaskKanban({ tasks, onStatusChange, onTaskClick }: TaskKanbanProps) {
  const [activeTask, setActiveTask] = useState<TaskCard | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === e.active.id) ?? null);
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    const newStatus = over.id as TaskStatus;
    if (!task || task.status === newStatus) return;
    await onStatusChange(task.id, newStatus);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={(e) => void handleDragEnd(e)}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanCol
            key={col.id}
            col={col}
            tasks={tasks.filter((t) => t.status === col.id)}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <DraggableTaskCard task={activeTask} onClick={() => {}} overlay />
        )}
      </DragOverlay>
    </DndContext>
  );
}

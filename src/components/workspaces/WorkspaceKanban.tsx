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
import { Calendar, GripVertical, Plus } from "lucide-react";
import type { WorkspaceTask, WorkspaceMember } from "./types";

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: { id: WorkspaceTask["status"]; label: string; color: string }[] = [
  { id: "IDEA", label: "Idea", color: "badge-neutral" },
  { id: "IN_PROGRESS", label: "In Progress", color: "badge-warning" },
  { id: "IN_REVIEW", label: "In Review", color: "badge-info" },
  { id: "APPROVED", label: "Approved", color: "badge-success" },
  { id: "PUBLISHED", label: "Published", color: "badge-primary" },
  { id: "ARCHIVED", label: "Archived", color: "badge-ghost" },
];

// ── Droppable column ──────────────────────────────────────────────────────────

function KanbanColumn({
  column,
  tasks,
  members,
  onTaskClick,
  onAddTask,
}: {
  column: typeof COLUMNS[number];
  tasks: WorkspaceTask[];
  members: WorkspaceMember[];
  onTaskClick: (task: WorkspaceTask) => void;
  onAddTask: (status: WorkspaceTask["status"]) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[240px] w-[240px] rounded-xl border transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : "border-base-300 bg-base-200"
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-base-300">
        <div className="flex items-center gap-2">
          <span className={`badge badge-sm ${column.color}`}>{tasks.length}</span>
          <span className="text-sm font-semibold text-base-content">{column.label}</span>
        </div>
        <button
          className="btn btn-ghost btn-xs btn-circle"
          onClick={() => onAddTask(column.id)}
          title={`Add to ${column.label}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
        {tasks.map((task) => (
          <DraggableCard
            key={task.id}
            task={task}
            members={members}
            onClick={() => onTaskClick(task)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Draggable card ────────────────────────────────────────────────────────────

function DraggableCard({
  task,
  members,
  onClick,
  overlay = false,
}: {
  task: WorkspaceTask;
  members: WorkspaceMember[];
  onClick: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  const assignees = task.assigneeIds
    .map((id) => members.find((m) => m.userId === id)?.user)
    .filter(Boolean);

  return (
    <div
      ref={setNodeRef}
      className={`card bg-base-100 shadow-sm border border-base-300 cursor-pointer hover:border-primary/40 transition-colors ${
        isDragging && !overlay ? "opacity-30" : ""
      } ${overlay ? "rotate-1 shadow-xl" : ""}`}
    >
      <div className="card-body p-3 gap-2">
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

        <div className="flex items-center gap-1 text-xs text-base-content/50">
          <Calendar className="w-3 h-3" />
          {new Date(task.createdAt).toLocaleDateString()}
        </div>

        {assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {assignees.slice(0, 4).map((u) =>
              u ? (
                <div
                  key={u.id}
                  className="w-5 h-5 rounded-full bg-primary/30 border border-base-100 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0"
                  title={u.name}
                >
                  {u.name[0]}
                </div>
              ) : null
            )}
            {assignees.length > 4 && (
              <div className="w-5 h-5 rounded-full bg-base-300 border border-base-100 flex items-center justify-center text-xs text-base-content/60">
                +{assignees.length - 4}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Kanban board ─────────────────────────────────────────────────────────

interface WorkspaceKanbanProps {
  tasks: WorkspaceTask[];
  members: WorkspaceMember[];
  onStatusChange: (taskId: string, newStatus: WorkspaceTask["status"]) => Promise<void>;
  onTaskClick: (task: WorkspaceTask) => void;
  onAddTask: (status: WorkspaceTask["status"]) => void;
}

export function WorkspaceKanban({
  tasks,
  members,
  onStatusChange,
  onTaskClick,
  onAddTask,
}: WorkspaceKanbanProps) {
  const [activeTask, setActiveTask] = useState<WorkspaceTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as WorkspaceTask["status"];
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    await onStatusChange(taskId, newStatus);
  }

  const tasksByColumn = (status: WorkspaceTask["status"]) =>
    tasks.filter((t) => t.status === status);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={(e) => void handleDragEnd(e)}>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasksByColumn(col.id)}
            members={members}
            onTaskClick={onTaskClick}
            onAddTask={onAddTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <DraggableCard task={activeTask} members={members} onClick={() => {}} overlay />
        )}
      </DragOverlay>
    </DndContext>
  );
}

import type { ProjectStatus } from "@prisma/client";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_CLASS: Record<ProjectStatus, string> = {
  PENDING: "badge-ghost",
  ACTIVE: "badge-primary",
  ON_HOLD: "badge-warning",
  COMPLETED: "badge-success",
  CANCELLED: "badge-error",
};

interface StatusBadgeProps {
  status: ProjectStatus;
}

/**
 * Compact DaisyUI badge for project lifecycle status.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`badge badge-sm whitespace-nowrap ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

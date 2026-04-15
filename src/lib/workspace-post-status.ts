import type { WorkspaceTaskStatus } from "@/components/workspaces/types";

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);
const MANAGER_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"]);

const ALL_STATUSES: WorkspaceTaskStatus[] = [
  "IDEA",
  "IN_PROGRESS",
  "IN_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "ARCHIVED",
];

/**
 * Whether `role` may move a post from `from` to `to`.
 * - Admins: any transition.
 * - Project managers: any except changing a post that is already **Published** (only Super Admin / Admin may).
 * - Others: free movement among Idea / In progress / In review; **Approved** and **Archive** require manager; from **Approved** only **Published**; **Published** and **Archived** locked (except managers/admins per above).
 */
export function canTransitionWorkspacePost(
  role: string,
  from: WorkspaceTaskStatus,
  to: WorkspaceTaskStatus
): boolean {
  if (from === to) return true;

  if (to === "APPROVED" && !MANAGER_ROLES.has(role)) return false;
  if (to === "ARCHIVED" && !MANAGER_ROLES.has(role)) return false;

  if (ADMIN_ROLES.has(role)) return true;

  if (role === "PROJECT_MANAGER") {
    if (from === "PUBLISHED") return false;
    return true;
  }

  if (["IDEA", "IN_PROGRESS", "IN_REVIEW"].includes(from)) {
    return ["IDEA", "IN_PROGRESS", "IN_REVIEW"].includes(to);
  }
  if (from === "APPROVED") {
    return to === "PUBLISHED";
  }
  if (from === "PUBLISHED") {
    return false;
  }
  if (from === "ARCHIVED") {
    return false;
  }
  return false;
}

/**
 * Targets the user may set from the current status (excluding the current status).
 */
export function getAllowedWorkspacePostTargets(
  role: string,
  from: WorkspaceTaskStatus
): WorkspaceTaskStatus[] {
  return ALL_STATUSES.filter((to) => to !== from && canTransitionWorkspacePost(role, from, to));
}

/**
 * Prefer the “happy path” single-step action: Idea→In progress→In review→Approved→Published, then (admin) archive, or un-archive to Idea.
 */
export function getPrimaryWorkspacePostTarget(
  role: string,
  from: WorkspaceTaskStatus
): WorkspaceTaskStatus | null {
  const candidates: WorkspaceTaskStatus[] = [];

  switch (from) {
    case "IDEA":
      candidates.push("IN_PROGRESS");
      break;
    case "IN_PROGRESS":
      candidates.push("IN_REVIEW");
      break;
    case "IN_REVIEW":
      candidates.push("APPROVED", "IN_PROGRESS", "IDEA");
      break;
    case "APPROVED":
      candidates.push("PUBLISHED");
      break;
    case "PUBLISHED":
      break;
    case "ARCHIVED":
      candidates.push("IDEA");
      break;
    default:
      break;
  }

  for (const to of candidates) {
    if (canTransitionWorkspacePost(role, from, to)) return to;
  }
  return null;
}

export function canArchiveWorkspacePost(role: string, from: WorkspaceTaskStatus): boolean {
  if (from === "ARCHIVED") return false;
  return canTransitionWorkspacePost(role, from, "ARCHIVED");
}

/** Label for the primary button (short). */
export function primaryWorkspacePostButtonLabel(to: WorkspaceTaskStatus): string {
  switch (to) {
    case "IN_PROGRESS":
      return "In progress";
    case "IN_REVIEW":
      return "In review";
    case "APPROVED":
      return "Approved";
    case "PUBLISHED":
      return "Published";
    case "ARCHIVED":
      return "Archive";
    case "IDEA":
      return "Idea";
    default:
      return to;
  }
}

/** Menu label for changing to a given status. */
export function workspacePostMenuLabel(to: WorkspaceTaskStatus): string {
  return `Change to ${primaryWorkspacePostButtonLabel(to).toLowerCase()}`;
}

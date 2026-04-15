export type WorkspaceTaskStatus =
  | "IDEA"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "ARCHIVED";

export type WorkspaceTask = {
  id: string;
  title: string;
  description: string | null;
  status: WorkspaceTaskStatus;
  assigneeIds: string[];
  attachments: string[];
  thumbnailPath: string | null;
  postedAt: string | null;
  completedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMember = {
  userId: string;
  user: { id: string; name: string; profilePicUrl: string | null; role: string };
};

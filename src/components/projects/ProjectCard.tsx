import Link from "next/link";
import type { Milestone, Project, ProjectMember, User } from "@prisma/client";
import { StatusBadge } from "@/components/projects/StatusBadge";
import { AvatarStack } from "@/components/projects/AvatarStack";

export type ProjectCardModel = Project & {
  milestones: Milestone[];
  members: (ProjectMember & { user: Pick<User, "id" | "name" | "profilePicUrl"> })[];
  client: Pick<User, "id" | "name"> | null;
};

function milestoneSummary(milestones: Milestone[]) {
  const total = milestones.length;
  const completedCount = milestones.filter((m) => m.status === "COMPLETED").length;
  const totalCount = total > 0 ? total : 1;
  const currentMilestone =
    milestones.find((m) => m.status !== "COMPLETED") ?? milestones[milestones.length - 1];
  return { completedCount, totalCount, currentMilestone };
}

interface ProjectCardProps {
  project: ProjectCardModel;
}

/**
 * Project summary card (shared with dashboard and future `/projects` listing).
 */
export function ProjectCard({ project }: ProjectCardProps) {
  const { completedCount, totalCount, currentMilestone } = milestoneSummary(project.milestones);
  const stackUsers = project.members.slice(0, 3).map((m) => ({
    id: m.user.id,
    name: m.user.name,
    profilePicUrl: m.user.profilePicUrl,
  }));
  const overflow = Math.max(0, project.members.length - 3);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-base-300 hover:border-primary/30 block"
    >
      <div className="card-body p-4 gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base-content line-clamp-1">{project.title}</h3>
          <StatusBadge status={project.status} />
        </div>
        <div className="text-sm text-base-content/60">
          Milestone {completedCount}/{totalCount}
          {currentMilestone ? (
            <>
              {" "}
              —{" "}
              <span className="capitalize">{currentMilestone.status.toLowerCase().replace("_", " ")}</span>
            </>
          ) : null}
        </div>
        <progress
          className="progress progress-primary w-full h-1.5"
          value={completedCount}
          max={totalCount}
        />
        <div className="flex items-center justify-between gap-2">
          <AvatarStack users={stackUsers} overflow={overflow} />
          <span className="text-xs text-base-content/50 truncate max-w-[50%] text-end">
            {project.client?.name ?? "—"}
          </span>
        </div>
      </div>
    </Link>
  );
}

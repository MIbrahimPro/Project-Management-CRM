import type { ReactNode } from "react";
import type { UserRole } from "@prisma/client";
import type { DashboardData } from "@/lib/dashboard-data";
import { ProjectCard, type ProjectCardModel } from "@/components/projects/ProjectCard";

interface RoleWidgetsProps {
  data: DashboardData;
  role: UserRole;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold text-base-content mb-3">{children}</h2>;
}

/**
 * Role-specific dashboard cards (projects, tasks, HR, finance, etc.).
 */
export function RoleWidgets({ data, role }: RoleWidgetsProps) {
  if (role === "ADMIN" || role === "PROJECT_MANAGER") {
    const projects = "projects" in data ? (data.projects ?? []) : [];
    const requests =
      "pendingClientRequests" in data ? (data.pendingClientRequests ?? []) : [];
    const questions = "pendingQuestions" in data ? (data.pendingQuestions ?? []) : [];

    return (
      <>
        <div className="xl:col-span-2">
          <SectionTitle>Projects</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.length === 0 ? (
              <p className="text-sm text-base-content/50">No projects yet.</p>
            ) : (
              projects.map((p) => <ProjectCard key={p.id} project={p as ProjectCardModel} />)
            )}
          </div>
        </div>
        <div>
          <SectionTitle>Pending client requests</SectionTitle>
          <div className="card bg-base-200 border border-base-300 shadow-sm">
            <div className="card-body p-4 gap-2 max-h-64 overflow-y-auto">
              {requests.length === 0 ? (
                <p className="text-sm text-base-content/50">None pending.</p>
              ) : (
                <ul className="space-y-2">
                  {requests.map((r) => (
                    <li key={r.id} className="text-sm border-b border-base-300 pb-2 last:border-0">
                      <p className="font-medium text-base-content line-clamp-1">{r.title}</p>
                      <p className="text-xs text-base-content/50">
                        {r.project?.title ?? "Unassigned"} · {r.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div>
          <SectionTitle>Questions awaiting approval</SectionTitle>
          <div className="card bg-base-200 border border-base-300 shadow-sm">
            <div className="card-body p-4 gap-2 max-h-64 overflow-y-auto">
              {questions.length === 0 ? (
                <p className="text-sm text-base-content/50">All caught up.</p>
              ) : (
                <ul className="space-y-2">
                  {questions.map((q) => (
                    <li key={q.id} className="text-sm border-b border-base-300 pb-2 last:border-0">
                      <p className="text-base-content line-clamp-2">{q.text}</p>
                      <p className="text-xs text-base-content/50 mt-1">
                        {q.project.title}
                        {q.milestone ? ` · ${q.milestone.title}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (role === "DEVELOPER" || role === "DESIGNER") {
    const tasks = "myTasks" in data ? (data.myTasks ?? []) : [];
    return (
      <div className="xl:col-span-2">
        <SectionTitle>My tasks</SectionTitle>
        <div className="card bg-base-200 border border-base-300 shadow-sm">
          <div className="card-body p-4 gap-0 divide-y divide-base-300">
            {tasks.length === 0 ? (
              <p className="text-sm text-base-content/50 py-2">No open tasks.</p>
            ) : (
              tasks.map((t) => (
                <div key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-1 py-3 first:pt-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-base-content">{t.title}</p>
                    <p className="text-xs text-base-content/50">
                      {t.project?.title ?? "Social media"} · {t.status.replace("_", " ")}
                    </p>
                  </div>
                  <span className="badge badge-outline border-base-300 shrink-0">
                    {t.status.replace("_", " ")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (role === "HR") {
    const hiring = ("hiringStats" in data ? data.hiringStats : undefined) ?? {
      recentHiring: [],
    };
    const alerts =
      ("attendanceAlerts" in data ? data.attendanceAlerts : undefined) ?? { today: {} };
    const attendanceToday = alerts.today ?? {};
    const recent = hiring.recentHiring ?? [];

    return (
      <>
        <div>
          <SectionTitle>Hiring pipeline</SectionTitle>
          <div className="card bg-base-200 border border-base-300 shadow-sm">
            <div className="card-body p-4 gap-2 max-h-72 overflow-y-auto">
              {recent.length === 0 ? (
                <p className="text-sm text-base-content/50">No open requisitions.</p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((h) => (
                    <li key={h.id} className="text-sm border-b border-base-300 pb-2 last:border-0">
                      <p className="font-medium text-base-content line-clamp-1">
                        {h.publicTitle ?? h.statedRole}
                      </p>
                      <p className="text-xs text-base-content/50">
                        {h.requestedBy.name} · {h._count.candidates} candidates · {h.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div>
          <SectionTitle>Attendance today</SectionTitle>
          <div className="card bg-base-200 border border-base-300 shadow-sm">
            <div className="card-body p-4 gap-2">
              {Object.keys(attendanceToday).length === 0 ? (
                <p className="text-sm text-base-content/50">No records yet today.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {Object.entries(attendanceToday).map(([status, count]) => (
                    <li key={status} className="flex justify-between gap-2">
                      <span className="text-base-content/70 capitalize">
                        {status.toLowerCase().replace("_", " ")}
                      </span>
                      <span className="font-medium text-base-content">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (role === "ACCOUNTANT") {
    const stats =
      ("accountStats" in data ? data.accountStats : undefined) ?? { recentEntries: [] };
    const entries = stats.recentEntries ?? [];

    return (
      <div className="xl:col-span-2">
        <SectionTitle>Recent ledger entries</SectionTitle>
        <div className="card bg-base-200 border border-base-300 shadow-sm">
          <div className="card-body p-0 overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr className="border-b border-base-300">
                  <th className="text-base-content/70">Date</th>
                  <th className="text-base-content/70">Type</th>
                  <th className="text-base-content/70">Amount</th>
                  <th className="text-base-content/70">Description</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-sm text-base-content/50">
                      No entries yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((e) => (
                    <tr key={e.id} className="border-b border-base-300 hover:bg-base-300/30">
                      <td className="text-xs whitespace-nowrap">
                        {new Date(e.date).toLocaleDateString()}
                      </td>
                      <td>
                        <span className="badge badge-sm badge-outline border-base-300 capitalize">
                          {e.type.toLowerCase()}
                        </span>
                      </td>
                      <td className="font-mono text-sm">
                        ${Number(e.amountUsd).toLocaleString()}
                      </td>
                      <td className="text-sm max-w-xs truncate">
                        {e.description}
                        {e.project ? (
                          <span className="text-base-content/50"> · {e.project.title}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (role === "SALES") {
    const projects = "projects" in data ? (data.projects ?? []) : [];
    const tasks = "myTasks" in data ? (data.myTasks ?? []) : [];

    return (
      <>
        <div className="xl:col-span-2">
          <SectionTitle>My deals</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.length === 0 ? (
              <p className="text-sm text-base-content/50">No projects yet.</p>
            ) : (
              projects.map((p) => <ProjectCard key={p.id} project={p as ProjectCardModel} />)
            )}
          </div>
        </div>
        <div>
          <SectionTitle>My tasks</SectionTitle>
          <div className="card bg-base-200 border border-base-300 shadow-sm">
            <div className="card-body p-4 gap-0 divide-y divide-base-300 max-h-80 overflow-y-auto">
              {tasks.length === 0 ? (
                <p className="text-sm text-base-content/50 py-2">No open tasks.</p>
              ) : (
                tasks.map((t) => (
                  <div key={t.id} className="py-3 first:pt-0">
                    <p className="font-medium text-base-content text-sm">{t.title}</p>
                    <p className="text-xs text-base-content/50">
                      {t.project?.title ?? "—"} · {t.status.replace("_", " ")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (role === "CLIENT") {
    const projects = "projects" in data ? (data.projects ?? []) : [];
    return (
      <div className="xl:col-span-2">
        <SectionTitle>Your projects</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.length === 0 ? (
            <p className="text-sm text-base-content/50">No projects yet.</p>
          ) : (
            projects.map((p) => <ProjectCard key={p.id} project={p as ProjectCardModel} />)
          )}
        </div>
      </div>
    );
  }

  return null;
}

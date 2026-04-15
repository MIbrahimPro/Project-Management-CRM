"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useSidebarOverride } from "@/components/layout/ClientLayout";
import { getProjectSidebarItems } from "@/config/sidebar";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const { setOverride } = useSidebarOverride();
  const projectId = params?.id ?? null;
  const [projectTitle, setProjectTitle] = useState<string>("");

  useEffect(() => {
    if (!projectId) return;
    setOverride(getProjectSidebarItems(projectId));
    return () => setOverride(null);
  }, [projectId, setOverride]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function loadProjectTitle() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { data?: { title?: string } };
        if (!cancelled) setProjectTitle(data.data?.title ?? "");
      } catch {
        // noop
      }
    }
    void loadProjectTitle();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const sectionLabel = useMemo(() => {
    if (!projectId || !pathname) return "";
    if (pathname.endsWith(`/projects/${projectId}`)) return "Dashboard";
    if (pathname.includes(`/projects/${projectId}/chat`)) return "Chat";
    if (pathname.includes(`/projects/${projectId}/documents`)) return "Documents";
    if (pathname.includes(`/projects/${projectId}/questions`)) return "Questions";
    if (pathname.includes(`/projects/${projectId}/vault`)) return "Vault";
    return "Project";
  }, [pathname, projectId]);

  // Refresh the unanswered-questions badge whenever this project layout is mounted
  // and again on a 30s interval (cheap fallback if sockets aren't wired yet).
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function loadBadge() {
      try {
        const res = await fetch(`/api/projects/${projectId}/questions`);
        if (!res.ok) return;
        const json = (await res.json()) as { data?: { isApproved?: boolean; answers?: unknown[] }[] };
        const items = json.data ?? [];
        // Unanswered = approved questions with zero answers (matches the questions page semantics)
        const unanswered = items.filter(
          (q) => q.isApproved !== false && (!q.answers || q.answers.length === 0),
        ).length;
        if (cancelled) return;
        window.dispatchEvent(
          new CustomEvent("sidebar-badge", { detail: { key: "questionsUnanswered", count: unanswered } }),
        );
      } catch {
        /* noop */
      }
    }

    void loadBadge();
    const interval = setInterval(() => void loadBadge(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.dispatchEvent(
        new CustomEvent("sidebar-badge", { detail: { key: "questionsUnanswered", count: 0 } }),
      );
    };
  }, [projectId]);

  return (
    <div className="space-y-3">
      <div className="text-sm breadcrumbs text-base-content/60">
        <ul>
          <li>
            <Link href="/projects">Projects</Link>
          </li>
          <li className="font-medium text-base-content">
            {projectTitle || "Project"}
          </li>
          {sectionLabel && sectionLabel !== "Dashboard" && <li>{sectionLabel}</li>}
        </ul>
      </div>
      {children}
    </div>
  );
}

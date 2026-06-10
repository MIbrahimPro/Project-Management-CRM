"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useSidebarOverride, useUser } from "@/components/layout/ClientLayout";
import { getProjectSidebarItems } from "@/config/sidebar";
import FloatingAIChat from "@/components/projects/FloatingAIChat";
import { useSocket } from "@/hooks/useSocket";
import { SHOW_AI_FEATURES } from "@/config/features";
import toast from "react-hot-toast";

async function refreshChatBadge() {
  try {
    const res = await fetch("/api/chat/unseen");
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { count: number } };
    const count = json.data?.count ?? 0;
    window.dispatchEvent(
      new CustomEvent("sidebar-badge", { detail: { key: "chatUnseen", count } }),
    );
  } catch {
    /* noop */
  }
}

async function refreshQuestionBadge(projectId: string, isManager: boolean, isClient: boolean) {
  try {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) return;
    const json = (await res.json()) as {
      data?: { unansweredQuestions?: number; pendingApprovalCount?: number };
    };
    const data = json.data;
    if (!data) return;

    // For clients: show unanswered (approved + no answers)
    // For managers and all other team members: show unapproved + unanswered
    const count = isClient
      ? (data.unansweredQuestions ?? 0)
      : ((data.pendingApprovalCount ?? 0) + (data.unansweredQuestions ?? 0));
    window.dispatchEvent(
      new CustomEvent("sidebar-badge", { detail: { key: "questionsUnanswered", count } }),
    );
  } catch {
    /* noop */
  }
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { setOverride } = useSidebarOverride();
  const user = useUser();
  const projectId = params?.id ?? null;
  const [projectTitle, setProjectTitle] = useState<string>("");

  const isManager = user?.role ? ["ADMIN", "PROJECT_MANAGER"].includes(user.role) : false;
  const isClient = user?.role === "CLIENT";
  const { socket } = useSocket("/chat");
  const { socket: projectsSocket } = useSocket("/projects");

  const refreshBadge = useCallback(() => {
    if (projectId) {
      void refreshQuestionBadge(projectId, isManager, isClient);
    }
  }, [projectId, isManager, isClient]);

  useEffect(() => {
    if (!projectId) return;
    setOverride(getProjectSidebarItems(projectId, user.role));
    return () => setOverride(null);
  }, [projectId, setOverride, user.role]);

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

  useEffect(() => {
    if (!projectsSocket || !projectId) return;

    const onProjectUpdated = (data: { project?: { id: string; title?: string } }) => {
      if (data.project?.id === projectId && data.project.title) {
        setProjectTitle(data.project.title);
      }
    };
    const onAccessRevoked = (data: { projectId: string }) => {
      if (data.projectId === projectId) {
        toast.error("Your access to this project was removed.", {
          style: { background: "hsl(var(--b2))", color: "hsl(var(--er))" },
        });
        router.replace("/dashboard");
      }
    };

    projectsSocket.on("project_updated", onProjectUpdated);
    projectsSocket.on("project_access_revoked", onAccessRevoked);
    return () => {
      projectsSocket.off("project_updated", onProjectUpdated);
      projectsSocket.off("project_access_revoked", onAccessRevoked);
    };
  }, [projectsSocket, projectId, router]);

  const sectionLabel = useMemo(() => {
    if (!projectId || !pathname) return "";
    if (pathname.endsWith(`/projects/${projectId}`)) return "Dashboard";
    if (pathname.includes(`/projects/${projectId}/chat`)) return "Chat";
    if (pathname.includes(`/projects/${projectId}/meetings`)) return "Meetings";
    if (pathname.includes(`/projects/${projectId}/documents`)) return "Milestone Docs";
    if (pathname.includes(`/projects/${projectId}/questions`)) return "Questions";
    if (pathname.includes(`/projects/${projectId}/vault`)) return "Vault";
    if (pathname.includes(`/projects/${projectId}/assets`)) return "Assets";
    if (pathname.includes(`/projects/${projectId}/tasks`)) return "Tasks";
    return "Project";
  }, [pathname, projectId]);

  // Global toast notifications for project events
  useEffect(() => {
    if (!socket || !projectId) return;

    const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };

    const onAssetCreated = (data: { asset?: { name?: string } }) => {
      if (!pathname?.includes("/assets")) {
        toast.success(`New asset: ${data.asset?.name ?? "Uploaded"}`, { style: TOAST_STYLE });
      }
    };
    const onAssetUpdated = (data: { asset?: { name?: string } }) => {
      if (!pathname?.includes("/assets")) {
        toast(`Asset updated: ${data.asset?.name ?? ""}`, { style: TOAST_STYLE });
      }
    };
    const onAssetDeleted = () => {
      if (!pathname?.includes("/assets")) {
        toast("Asset deleted", { style: TOAST_STYLE });
      }
    };

    const onVaultSaved = () => {
      if (!pathname?.includes("/vault")) {
        toast("Vault secret updated", { style: TOAST_STYLE });
      }
    };
    const onVaultDeleted = () => {
      if (!pathname?.includes("/vault")) {
        toast("Vault secret deleted", { style: TOAST_STYLE });
      }
    };

    const onQuestionAdded = () => {
      if (!pathname?.includes("/questions")) {
        toast("New question added", { style: TOAST_STYLE });
      }
      refreshBadge();
    };
    const onQuestionApproved = () => {
      if (!pathname?.includes("/questions")) {
        toast("Question approved", { style: TOAST_STYLE });
      }
      refreshBadge();
    };
    const onQuestionAnswered = () => {
      if (!pathname?.includes("/questions")) {
        toast("Question answered", { style: TOAST_STYLE });
      }
      refreshBadge();
    };
    const onQuestionUpdated = () => {
      if (!pathname?.includes("/questions")) {
        toast("Question updated", { style: TOAST_STYLE });
      }
      refreshBadge();
    };
    const onQuestionDeleted = () => {
      if (!pathname?.includes("/questions")) {
        toast("Question deleted", { style: TOAST_STYLE });
      }
      refreshBadge();
    };

    const onNewMessage = () => {
      void refreshChatBadge();
    };

    socket.on("asset_created", onAssetCreated);
    socket.on("asset_updated", onAssetUpdated);
    socket.on("asset_deleted", onAssetDeleted);
    socket.on("vault_secret_saved", onVaultSaved);
    socket.on("vault_secret_deleted", onVaultDeleted);
    socket.on("question_added", onQuestionAdded);
    socket.on("question_approved", onQuestionApproved);
    socket.on("question_answered", onQuestionAnswered);
    socket.on("question_updated", onQuestionUpdated);
    socket.on("question_deleted", onQuestionDeleted);
    socket.on("new_message", onNewMessage);

    return () => {
      socket.off("asset_created", onAssetCreated);
      socket.off("asset_updated", onAssetUpdated);
      socket.off("asset_deleted", onAssetDeleted);
      socket.off("vault_secret_saved", onVaultSaved);
      socket.off("vault_secret_deleted", onVaultDeleted);
      socket.off("question_added", onQuestionAdded);
      socket.off("question_approved", onQuestionApproved);
      socket.off("question_answered", onQuestionAnswered);
      socket.off("question_updated", onQuestionUpdated);
      socket.off("question_deleted", onQuestionDeleted);
      socket.off("new_message", onNewMessage);
    };
  }, [socket, projectId, pathname, refreshBadge]);

  // Initial badge loads
  useEffect(() => {
    if (!projectId) return;
    refreshBadge();
    void refreshChatBadge();
  }, [projectId, refreshBadge]);

  return (
    <div className="space-y-3">
      <div className="text-sm breadcrumbs text-base-content/60">
        <ul>
          <li>
            <Link href="/projects">Projects</Link>
          </li>
          <li>
            <Link href={`/projects/${projectId}`} className="font-medium text-base-content">
              {projectTitle || "Project"}
            </Link>
          </li>
          {sectionLabel && sectionLabel !== "Dashboard" && <li>{sectionLabel}</li>}
        </ul>
      </div>
      {children}
      {SHOW_AI_FEATURES && projectId && user.role !== "CLIENT" && <FloatingAIChat projectId={projectId} />}
    </div>
  );
}

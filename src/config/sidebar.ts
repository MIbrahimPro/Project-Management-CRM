export interface SidebarItem {
  label: string;
  href: string;
  icon: string; // lucide icon name — resolved client-side in Sidebar.tsx
  children?: Array<{ label: string; href: string; projectId?: string }>;
  isBackButton?: boolean;
  /** Optional unread/unanswered badge id — resolved live by ClientLayout via socket */
  badgeKey?: "questionsUnanswered";
}

export function getSidebarItems(role: string): SidebarItem[] {
  const base: SidebarItem[] = [
    { label: "Dashboard",  href: "/dashboard",  icon: "LayoutDashboard" },
    { label: "Projects",   href: "/projects",   icon: "FolderKanban" },
    { label: "Chat",       href: "/chat",        icon: "MessageSquare" },
    { label: "Tasks",      href: "/tasks",       icon: "CheckSquare" },
    { label: "Social Media", href: "/workspaces",  icon: "Layers" },
  ];

  if (["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "HR"].includes(role)) {
    base.push({ label: "HR",       href: "/hr",        icon: "Briefcase" });
  }
  if (["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"].includes(role)) {
    base.push({ label: "Finance",  href: "/accountant", icon: "Calculator" });
  }
  if (!["SUPER_ADMIN", "CLIENT"].includes(role)) {
    base.push({ label: "Attendance", href: "/attendance", icon: "Clock" });
  }
  if (["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(role)) {
    base.push({ label: "Admin",    href: "/admin",      icon: "Shield" });
  }

  return base;
}

/**
 * Admin area sub-nav. Manager has full admin parity — only SUPER_ADMIN is uniquely privileged.
 */
export function getAdminSidebarItems(viewerRole: string): SidebarItem[] {
  const base: SidebarItem[] = [
    { label: "Back", href: "/dashboard", icon: "ArrowLeft", isBackButton: true },
    { label: "Users", href: "/admin/users", icon: "Users" },
  ];
  if (["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(viewerRole)) {
    base.push({ label: "Hiring Approvals", href: "/admin/hiring", icon: "Briefcase" });
  }
  return base;
}

export function getProjectSidebarItems(projectId: string): SidebarItem[] {
  return [
    { label: "Back to Projects", href: "/projects",                          icon: "ArrowLeft", isBackButton: true },
    { label: "Dashboard",         href: `/projects/${projectId}`,              icon: "LayoutDashboard" },
    { label: "AI Chat",           href: `/projects/${projectId}/ai`,           icon: "Sparkles" },
    { label: "Chat",              href: `/projects/${projectId}/chat`,         icon: "MessageSquare" },
    { label: "Questions",         href: `/projects/${projectId}/questions`,    icon: "MessageCircleQuestion", badgeKey: "questionsUnanswered" },
    { label: "Documents",         href: `/projects/${projectId}/documents`,    icon: "FileText" },
    { label: "Vault",             href: `/projects/${projectId}/vault`,        icon: "KeyRound" },
  ];
}

export function getHrSidebarItems(): SidebarItem[] {
  return [
    { label: "Back", href: "/dashboard", icon: "ArrowLeft", isBackButton: true },
    { label: "Hiring", href: "/hr", icon: "Briefcase" },
    { label: "Employee Management", href: "/hr/employees", icon: "Users" },
    { label: "Contracts", href: "/hr/contracts", icon: "FileText" },
  ];
}

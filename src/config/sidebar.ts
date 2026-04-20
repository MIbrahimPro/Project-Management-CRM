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
  ];

  if (role !== "CLIENT") {
    base.push({ label: "Tasks",      href: "/tasks",       icon: "CheckSquare" });
    base.push({ label: "Social Media", href: "/workspaces",  icon: "Layers" });
  }

  if (["ADMIN", "PROJECT_MANAGER", "HR"].includes(role)) {
    base.push({ label: "HR",       href: "/hr",        icon: "Briefcase" });
  }
  if (["ADMIN", "ACCOUNTANT"].includes(role)) {
    base.push({ label: "Finance",  href: "/accountant", icon: "Calculator" });
  }
  if (role !== "CLIENT") {
    base.push({ label: "Attendance", href: "/attendance", icon: "Clock" });
  }
  if (["ADMIN", "PROJECT_MANAGER"].includes(role)) {
    base.push({ label: "Admin",    href: "/admin",      icon: "Shield" });
  }

  return base;
}

/**
 * Admin area sub-nav. Manager has full admin parity.
 */
export function getAdminSidebarItems(viewerRole: string): SidebarItem[] {
  const base: SidebarItem[] = [
    { label: "Back", href: "/dashboard", icon: "ArrowLeft", isBackButton: true },
    { label: "Users", href: "/admin/users", icon: "Users" },
  ];
  if (["ADMIN", "PROJECT_MANAGER"].includes(viewerRole)) {
    base.push({ label: "Hiring Approvals", href: "/admin/hiring", icon: "Briefcase" });
  }
  return base;
}

export function getProjectSidebarItems(projectId: string, role: string): SidebarItem[] {
  const items: SidebarItem[] = [
    { label: "Back to Projects", href: "/projects",                          icon: "ArrowLeft", isBackButton: true },
    { label: "Dashboard",         href: `/projects/${projectId}`,              icon: "LayoutDashboard" },
  ];

  if (role !== "CLIENT") {
    items.push({ label: "AI Chat", href: `/projects/${projectId}/ai`, icon: "Sparkles" });
  }

  items.push(
    { label: "Chat",              href: `/projects/${projectId}/chat`,         icon: "MessageSquare" },
    { label: "Questions",         href: `/projects/${projectId}/questions`,    icon: "MessageCircleQuestion", badgeKey: "questionsUnanswered" },
    { label: "Milestone Docs",     href: `/projects/${projectId}/documents`,    icon: "FileText" },
    { label: "Vault",             href: `/projects/${projectId}/vault`,        icon: "KeyRound" },
  );

  if (role !== "CLIENT") {
    items.push({ label: "Tasks", href: `/projects/${projectId}/tasks`, icon: "CheckSquare" });
    items.push({ label: "Meetings", href: `/projects/${projectId}/meetings`, icon: "Video" });
  }

  return items;
}

export function getHrSidebarItems(): SidebarItem[] {
  return [
    { label: "Back", href: "/dashboard", icon: "ArrowLeft", isBackButton: true },
    { label: "Hiring", href: "/hr", icon: "Briefcase" },
    { label: "Employee Management", href: "/hr/employees", icon: "Users" },
    { label: "Contracts", href: "/hr/contracts", icon: "FileText" },
  ];
}

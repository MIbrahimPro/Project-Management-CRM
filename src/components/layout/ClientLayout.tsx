"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { AISidebar } from "@/components/ai/AISidebar";
import { FetchInterceptor } from "@/components/auth/FetchInterceptor";
import type { SidebarItem } from "@/config/sidebar";

interface SidebarOverrideContextValue {
  setOverride: (items: SidebarItem[] | null) => void;
}

const SidebarOverrideContext = createContext<SidebarOverrideContextValue>({
  setOverride: () => {},
});

export function useSidebarOverride() {
  return useContext(SidebarOverrideContext);
}

interface ClientLayoutProps {
  user: {
    id: string;
    name: string;
    role: string;
    profilePicUrl?: string | null;
  };
  sidebarItems: SidebarItem[];
  children: React.ReactNode;
}

export function ClientLayout({ user, sidebarItems, children }: ClientLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sidebarOverride, setSidebarOverride] = useState<SidebarItem[] | null>(null);

  const ATTENDANCE_ROLES = ["ADMIN", "PROJECT_MANAGER", "DEVELOPER", "DESIGNER", "HR", "ACCOUNTANT", "SALES"];

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);

    // Auto check-in on first visit of the day for attendance-eligible roles
    if (ATTENDANCE_ROLES.includes(user.role)) {
      const today = new Date().toISOString().slice(0, 10);
      const key = `lastAutoCheckIn:${user.id}`;
      if (localStorage.getItem(key) !== today) {
        fetch("/api/attendance/check-in", { method: "POST" })
          .then((res) => {
            if (res.ok) localStorage.setItem(key, today);
          })
          .catch(() => {});
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  function openMobile() {
    setMobileOpen(true);
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  const sidebarWidth = mounted ? (collapsed ? "64px" : "240px") : "240px";
  const activeSidebarItems = sidebarOverride ?? sidebarItems;

  return (
    <SidebarOverrideContext.Provider value={{ setOverride: setSidebarOverride }}>
    <FetchInterceptor />
    <div className="flex h-screen overflow-hidden bg-base-100">
      {/* Desktop sidebar */}
      <div
        className="hidden lg:flex flex-col transition-all duration-300 ease-in-out flex-shrink-0"
        style={{ width: sidebarWidth }}
      >
        <Sidebar
          items={activeSidebarItems}
          collapsed={collapsed}
          onCollapse={toggleCollapse}
        />
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="w-60 h-full">
          <Sidebar
            items={activeSidebarItems}
            isMobileOpen={mobileOpen}
            onMobileClose={closeMobile}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-300 ease-in-out">
        <Navbar user={user} onMenuClick={openMobile} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-base-100">
          {children}
        </main>
      </div>

      {/* AI Assistant floating sidebar */}
      <AISidebar userRole={user.role} />
    </div>
    </SidebarOverrideContext.Provider>
  );
}

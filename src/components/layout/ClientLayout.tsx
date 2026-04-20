"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { AISidebar } from "@/components/ai/AISidebar";
import { AttendanceOvertimeModal } from "@/components/attendance/AttendanceOvertimeModal";
import { useSocket } from "@/hooks/useSocket";
import { FetchInterceptor } from "@/components/auth/FetchInterceptor";
import { PresenceProvider } from "./PresenceProvider";
import toast from "react-hot-toast";
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

interface UserContextValue {
  user: ClientLayoutProps["user"];
}

const UserContext = createContext<UserContextValue | null>(null);

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within ClientLayout");
  return ctx.user;
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

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {}
}

export function ClientLayout({ user, sidebarItems, children }: ClientLayoutProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sidebarOverride, setSidebarOverride] = useState<SidebarItem[] | null>(null);

  // Overtime Modal State
  const [overtimeCheckInId, setOvertimeCheckInId] = useState<string | null>(null);

  const { socket: notifSocket } = useSocket("/notifications");

  useEffect(() => {
    if (!notifSocket) return;
    notifSocket.on("shift_complete", (data: { checkInId: string }) => {
      setOvertimeCheckInId(data.checkInId);
    });
    notifSocket.on("new_notification", (notif: { title: string; body: string; link?: string | null }) => {
      playNotificationSound();
      toast(
        (t) => (
          <button
            className="flex flex-col gap-0.5 text-left w-full"
            onClick={() => {
              toast.dismiss(t.id);
              if (notif.link) router.push(notif.link);
            }}
          >
            <span className="font-semibold text-sm text-base-content">{notif.title}</span>
            <span className="text-xs text-base-content/70 line-clamp-2">{notif.body}</span>
          </button>
        ),
        {
          duration: 5000,
          position: "top-center",
          style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))", maxWidth: "360px", padding: "12px 16px" },
        }
      );
    });
    return () => {
      notifSocket.off("shift_complete");
      notifSocket.off("new_notification");
    };
  }, [notifSocket, router]);

  const ATTENDANCE_ROLES = ["ADMIN", "PROJECT_MANAGER", "DEVELOPER", "DESIGNER", "HR", "ACCOUNTANT", "SALES"];

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);

    // Register the Web Push service worker once (Phase 6.3).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("[SW] registration failed:", err));
    }

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
    <PresenceProvider>
    <UserContext.Provider value={{ user }}>
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
      {/* Overtime Popup */}
      <AttendanceOvertimeModal 
        isOpen={!!overtimeCheckInId} 
        onClose={() => setOvertimeCheckInId(null)} 
        checkInId={overtimeCheckInId || ""} 
      />
    </div>
    </SidebarOverrideContext.Provider>
    </UserContext.Provider>
    </PresenceProvider>
  );
}

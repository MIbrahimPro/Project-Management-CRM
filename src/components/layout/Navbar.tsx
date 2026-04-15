"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  Settings,
  User,
  Palette,
  LogOut,
  ChevronDown,
  Menu,
  Zap,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { CheckInWidget } from "@/components/attendance/CheckInWidget";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useSocket } from "@/hooks/useSocket";
import toast from "react-hot-toast";

const ATTENDANCE_ROLES = [
  "PROJECT_MANAGER",
  "DEVELOPER",
  "DESIGNER",
  "HR",
  "ACCOUNTANT",
  "SALES",
];

interface NavbarUser {
  id: string;
  name: string;
  role: string;
  profilePicUrl?: string | null;
}

interface NavbarProps {
  user: NavbarUser;
  onMenuClick: () => void;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

type NotifItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  type: string;
  linkUrl?: string | null;
};

function NotificationBell() {
  const [hasUnread, setHasUnread] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { socket, connected } = useSocket("/notifications");

  useEffect(() => {
    let cancelled = false;
    async function refreshUnread() {
      try {
        const res = await fetch("/api/notifications/has-unread");
        const json = await res.json();
        if (!cancelled && json?.data) setHasUnread(Boolean(json.data.hasUnread));
      } catch { /* ignore */ }
    }
    void refreshUnread();
    const interval = setInterval(() => void refreshUnread(), 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!socket || !connected) return;
    const onNew = (n: NotifItem) => {
      setHasUnread(true);
      setNotifications((prev) => [n, ...prev].slice(0, 10));
      toast(n.title, {
        icon: "🔔",
        style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" },
        duration: 4500,
      });
    };
    const onUnread = (has: boolean) => setHasUnread(has);
    socket.on("new_notification", onNew);
    socket.on("has_unread", onUnread);
    return () => {
      socket.off("new_notification", onNew);
      socket.off("has_unread", onUnread);
    };
  }, [socket, connected]);

  // Close on click outside or Escape
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const toggleDropdown = useCallback(async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    try {
      const res = await fetch("/api/notifications?limit=5");
      const json = await res.json();
      if (json?.data?.notifications) setNotifications(json.data.notifications);
    } catch { /* ignore */ }
    if (hasUnread) {
      setHasUnread(false);
      fetch("/api/notifications/mark-all-read", { method: "POST" }).catch(() => {});
    }
  }, [open, hasUnread]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="btn btn-ghost btn-circle relative"
        onClick={() => void toggleDropdown()}
      >
        <Bell className="w-5 h-5" />
        {hasUnread && (
          <span className="badge badge-xs badge-error absolute -top-0.5 -right-0.5" />
        )}
      </button>
      {open && (
        <ul className="absolute right-0 top-full mt-2 bg-base-200 rounded-box z-50 w-72 p-2 shadow-lg border border-base-300 max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <li className="text-base-content/50 text-sm py-2 text-center">
              No notifications
            </li>
          ) : (
            notifications.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.linkUrl ?? "/notifications"}
                  className="block px-3 py-2 rounded-lg hover:bg-base-300 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <p className="text-sm font-medium text-base-content truncate">
                    {n.title}
                  </p>
                  <p className="text-xs text-base-content/60 truncate">{n.body}</p>
                  <p className="text-xs text-base-content/40 mt-0.5">
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </Link>
              </li>
            ))
          )}
          <li className="mt-1 border-t border-base-300 pt-1">
            <Link
              href="/notifications"
              className="block text-center text-primary text-sm py-1 hover:underline"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}

function SettingsButton() {
  return (
    <Link
      href="/settings"
      className="btn btn-ghost btn-circle"
    >
      <Settings className="w-5 h-5" />
    </Link>
  );
}

function ProfilePill({ user }: { user: NavbarUser }) {
  const { themes, theme, setTheme } = useTheme();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="flex items-center gap-2 bg-base-300 hover:bg-base-200 px-3 py-1.5 rounded-full cursor-pointer transition-colors"
      >
        <UserAvatar user={user} size={28} />
        <div className="hidden md:flex flex-col">
          <span className="text-sm font-medium text-base-content leading-none">
            {user.name}
          </span>
          <span className="text-xs text-base-content/50 leading-none capitalize">
            {user.role.toLowerCase().replace("_", " ")}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-base-content/50" />
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu bg-base-200 rounded-box z-50 w-52 p-2 shadow-lg border border-base-300 mt-2"
      >
        <li>
          <Link href="/profile">
            <User className="w-4 h-4" />
            View Profile
          </Link>
        </li>
        <li>
          <details>
            <summary>
              <Palette className="w-4 h-4" />
              Change Theme
            </summary>
            <ul>
              {themes.map((t) => (
                <li key={t}>
                  <button
                    onClick={() => setTheme(t as Parameters<typeof setTheme>[0])}
                    className={theme === t ? "active font-bold" : ""}
                  >
                    {t}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </li>
        <li>
          <button onClick={handleLogout} className="text-error">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </li>
      </ul>
    </div>
  );
}

export function Navbar({ user, onMenuClick }: NavbarProps) {
  const hasAttendance = ATTENDANCE_ROLES.includes(user.role);

  return (
    <>
      {/* Desktop navbar */}
      <nav className="hidden lg:flex items-center justify-end gap-2 px-4 py-2 bg-base-200 border-b border-base-300 h-16">
        {hasAttendance && <CheckInWidget />}
        <NotificationBell />
        <SettingsButton />
        <ProfilePill user={user} />
      </nav>

      {/* Mobile navbar */}
      <nav className="flex lg:hidden items-center justify-between px-4 py-2 bg-base-200 border-b border-base-300 h-16">
        <button
          onClick={onMenuClick}
          className="btn btn-ghost btn-sm"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-base-content">DevRolin</span>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/profile" className="btn btn-ghost btn-circle btn-sm">
            <UserAvatar user={user} size={28} />
          </Link>
          <NotificationBell />
        </div>
      </nav>
    </>
  );
}

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, Check, DollarSign, Link2, Lock, Palette } from "lucide-react";
import toast from "react-hot-toast";
import { useTheme } from "@/components/providers/ThemeProvider";

// ---- Types ----

type NotifPrefs = {
  chatInWorkHours: boolean;
  chatOutWorkHours: boolean;
  meetingScheduled: boolean;
  taskAssigned: boolean;
  taskChanged: boolean;
  awayCheck: boolean;
  projectChatInWorkHours: boolean;
  projectChatOutWorkHours: boolean;
};

type SettingsUser = {
  id: string;
  role: string;
  currencyPreference: string;
  isGoogleConnected: boolean;
  notifPreferences: NotifPrefs | null;
};

// ---- Constants ----

const CURRENCIES = [
  { value: "USD", label: "US Dollar (USD)" },
  { value: "PKR", label: "Pakistani Rupee (PKR)" },
  { value: "AUD", label: "Australian Dollar (AUD)" },
  { value: "GBP", label: "British Pound (GBP)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "CAD", label: "Canadian Dollar (CAD)" },
  { value: "AED", label: "UAE Dirham (AED)" },
] as const;

const NOTIF_TOGGLES: { key: keyof NotifPrefs; label: string; desc: string }[] = [
  { key: "chatInWorkHours",        label: "Chat Messages",    desc: "During work hours" },
  { key: "chatOutWorkHours",       label: "Chat Messages",    desc: "Outside work hours" },
  { key: "projectChatInWorkHours", label: "Project Chat",     desc: "During work hours" },
  { key: "projectChatOutWorkHours",label: "Project Chat",     desc: "Outside work hours" },
  { key: "meetingScheduled",       label: "Meeting Scheduled",desc: "When a meeting is scheduled" },
  { key: "taskAssigned",           label: "Task Assigned",    desc: "When a task is assigned to you" },
  { key: "taskChanged",            label: "Task Updated",     desc: "When your task status changes" },
  { key: "awayCheck",              label: "Away Check",       desc: "Pings to confirm you are still active" },
];

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

// ---- Inner component (needs useSearchParams → must be inside Suspense) ----

function SettingsContent() {
  const searchParams = useSearchParams();
  const { theme, setTheme, themes } = useTheme();
  const googleRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<SettingsUser | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    chatInWorkHours: true, chatOutWorkHours: false, meetingScheduled: true,
    taskAssigned: true, taskChanged: true, awayCheck: true,
    projectChatInWorkHours: true, projectChatOutWorkHours: false,
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Form fields
  const [currency, setCurrency] = useState("USD");

  // SSR-safe notification permission
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Load user data
  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d: { data?: SettingsUser }) => {
        if (!d.data) return;
        setUser(d.data);
        setCurrency(d.data.currencyPreference ?? "USD");
        if (d.data.notifPreferences) setNotifPrefs(d.data.notifPreferences);
      })
      .catch(() => {
        toast.error("Failed to load settings", { style: TOAST_ERROR_STYLE });
      });
  }, []);

  // Handle ?highlight=google-connect
  useEffect(() => {
    if (searchParams.get("highlight") !== "google-connect") return;
    const el = googleRef.current;
    if (!el) return;
    const timer = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("settings-pulse");
      setTimeout(() => el.classList.remove("settings-pulse"), 2500);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchParams]);

  // ---- Save helper ----

  async function saveSetting(key: string, data: Record<string, unknown>) {
    setSavingKey(key);
    try {
      const res = await fetch("/api/users/me/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Save failed");
      }
      toast.success("Saved", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleNotif(key: keyof NotifPrefs, value: boolean) {
    setNotifPrefs((p) => ({ ...p, [key]: value }));
    await saveSetting("notif", { [key]: value });
  }

  // ---- Google ----

  async function handleGoogleConnect() {
    try {
      const res = await fetch("/api/auth/google/init?flow=connect");
      const d = (await res.json()) as { data?: { url: string } };
      if (d.data?.url) window.location.href = d.data.url;
    } catch {
      toast.error("Could not initiate Google connection", { style: TOAST_ERROR_STYLE });
    }
  }

  async function handleGoogleDisconnect() {
    try {
      await fetch("/api/auth/google/disconnect", { method: "POST" });
      setUser((u) => u ? { ...u, isGoogleConnected: false } : u);
      toast.success("Google disconnected", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to disconnect", { style: TOAST_ERROR_STYLE });
    }
  }

  // ---- Push notifications ----

  async function requestNotifPermission() {
    if (!("Notification" in window)) {
      toast.error("Your browser does not support notifications", { style: TOAST_ERROR_STYLE });
      return;
    }
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);

    if (permission === "granted") {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
        toast.success("Push notifications enabled!", { style: TOAST_STYLE });
      } catch {
        toast.error("Failed to register push subscription", { style: TOAST_ERROR_STYLE });
      }
    } else if (permission === "denied") {
      toast.error("Permission denied — see instructions below to enable", { style: TOAST_ERROR_STYLE });
    }
  }

  if (!user) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes settings-pulse-anim {
          0%, 100% { box-shadow: 0 0 0 0 hsl(var(--p) / 0.4); }
          50%       { box-shadow: 0 0 0 14px hsl(var(--p) / 0); }
        }
        .settings-pulse { animation: settings-pulse-anim 0.8s ease-out 3; }
      `}</style>

      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-base-content">Settings</h1>
          <p className="text-sm text-base-content/60">Manage your account preferences.</p>
        </div>

        {/* ── Security ── */}
        <div className="card bg-base-200 border border-base-300 shadow-sm">
          <div className="card-body gap-3">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="card-title text-base">Security</h2>
            </div>
            <p className="text-sm text-base-content/60">Manage your account password.</p>
            <a href="/password-change" className="btn btn-outline btn-sm w-fit">
              Change Password
            </a>
          </div>
        </div>

        {/* ── Appearance ── */}
        <div className="card bg-base-200 border border-base-300 shadow-sm">
          <div className="card-body gap-4">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <h2 className="card-title text-base">Appearance</h2>
            </div>

            {/* Theme */}
            <div className="form-control gap-1">
              <label className="label py-0">
                <span className="label-text">Theme</span>
              </label>
              <select
                className="select select-bordered bg-base-100 w-full max-w-xs capitalize"
                value={theme}
                onChange={(e) => {
                  const next = e.target.value as Parameters<typeof setTheme>[0];
                  setTheme(next);
                  void saveSetting("theme", { theme: next });
                }}
              >
                {themes.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-base-content/50">
              Client edits in shared documents are auto-underlined as a system signal.
              Underline formatting is reserved for that — it cannot be applied manually.
            </p>
          </div>
        </div>

        {/* ── Currency ── */}
        <div className="card bg-base-200 border border-base-300 shadow-sm">
          <div className="card-body gap-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <h2 className="card-title text-base">Currency Preference</h2>
            </div>
            <p className="text-sm text-base-content/60">
              Monetary values will be displayed in your preferred currency.
            </p>
            <div className="flex items-center gap-3">
              <select
                className="select select-bordered bg-base-100 flex-1 max-w-xs"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => void saveSetting("currency", { currencyPreference: currency })}
                disabled={savingKey === "currency"}
              >
                {savingKey === "currency" ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Notifications ── */}
        <div className="card bg-base-200 border border-base-300 shadow-sm">
          <div className="card-body gap-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <h2 className="card-title text-base">Notifications</h2>
            </div>

            {/* Permission status banner */}
            <div className="rounded-lg bg-base-300 p-3">
              {notifPermission === "granted" && (
                <div className="flex items-center gap-2 text-success text-sm">
                  <Check className="w-4 h-4" />
                  Push notifications are enabled
                </div>
              )}
              {notifPermission === "default" && (
                <div className="space-y-2">
                  <p className="text-sm text-base-content/60">
                    Push notifications are not enabled yet.
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={() => void requestNotifPermission()}>
                    Enable Push Notifications
                  </button>
                </div>
              )}
              {notifPermission === "denied" && (
                <div className="space-y-2">
                  <p className="text-sm text-error">Push notifications are blocked.</p>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-primary">How to enable them</summary>
                    <div className="mt-2 space-y-1 text-base-content/70 pl-2">
                      <p><strong>Chrome:</strong> Address bar → lock icon → Notifications → Allow</p>
                      <p><strong>Firefox:</strong> Address bar → lock icon → Permissions → Allow Notifications</p>
                      <p><strong>Safari (iOS):</strong> Settings → Safari → Notifications → DevRolin → Allow</p>
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* Toggle rows */}
            <div className="divide-y divide-base-300">
              {NOTIF_TOGGLES.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-base-content">{label}</p>
                    <p className="text-xs text-base-content/50">{desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={notifPrefs[key]}
                    onChange={(e) => void toggleNotif(key, e.target.checked)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Google Integration ── */}
        <div
          ref={googleRef}
          id="google-connect"
          className="card bg-base-200 border border-base-300 shadow-sm transition-shadow"
        >
          <div className="card-body gap-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              <h2 className="card-title text-base">Google Integration</h2>
            </div>
            <p className="text-sm text-base-content/60">
              Connect Google to export documents to Google Docs and Drive.
            </p>
            {user.isGoogleConnected ? (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-success text-sm">
                  <Check className="w-4 h-4" />
                  Google account connected
                </div>
                <button
                  className="btn btn-ghost btn-sm text-error"
                  onClick={() => void handleGoogleDisconnect()}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                className="btn btn-outline btn-sm w-fit gap-2"
                onClick={() => void handleGoogleConnect()}
              >
                {/* Google G icon */}
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
                  <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z" />
                  <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z" />
                  <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
                </svg>
                Connect Google Account
              </button>
            )}
          </div>
        </div>

      </div>
    </>
  );
}

// ---- Page export ---- (Suspense required for useSearchParams in App Router)

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}

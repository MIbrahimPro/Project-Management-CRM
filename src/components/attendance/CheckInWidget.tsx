"use client";

import { useState, useEffect } from "react";
import { Clock, LogOut } from "lucide-react";
import toast from "react-hot-toast";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type StatusData = {
  isCheckedIn: boolean;
  checkIn: { checkedInAt: string; checkedOutAt: string | null } | null;
  attendance: { status: string } | null;
  workHoursEnd?: string | null;
};

/**
 * Check-in / check-out control with live status from `/api/attendance/*`.
 */
export function CheckInWidget() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/attendance/status")
      .then((res) => res.json())
      .then((json: { data?: StatusData }) => {
        if (!cancelled && json?.data) setStatus(json.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshStatus() {
    try {
      const res = await fetch("/api/attendance/status");
      const json = (await res.json()) as { data?: StatusData };
      if (json?.data) setStatus(json.data);
    } catch {
      /* ignore */
    }
  }

  async function handleCheckIn() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/check-in", { method: "POST" });
      const json = (await res.json()) as { data?: unknown; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Check-in failed");
      await refreshStatus();
      toast.success("Checked in", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/check-out", { method: "POST" });
      const json = (await res.json()) as { data?: unknown; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Check-out failed");
      await refreshStatus();
      toast.success("Checked out", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="skeleton w-24 h-9 rounded-lg" />;
  }

  const isCheckedIn = status?.isCheckedIn ?? false;
  const hasCheckedOutToday = !!status?.checkIn && !!status.checkIn.checkedOutAt;

  // Not checked in (never today, or already checked out) — show Check In button
  if (!isCheckedIn) {
    return (
      <button
        type="button"
        onClick={handleCheckIn}
        disabled={busy}
        className="btn btn-success btn-sm gap-2"
        title={hasCheckedOutToday ? "Start a new session" : "Check in"}
      >
        {busy ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <Clock className="w-4 h-4" />
        )}
        {hasCheckedOutToday ? "Check In Again" : "Check In"}
      </button>
    );
  }

  // Currently checked in — show time + expected checkout + dropdown
  const checkedInAt = status?.checkIn?.checkedInAt;
  const expectedOut = status?.workHoursEnd;

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-2 border border-base-300">
        <Clock className="w-4 h-4 text-success" />
        <div className="flex flex-col items-start leading-tight">
          <span className="text-xs text-base-content/70">
            {checkedInAt
              ? new Date(checkedInAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </span>
          {expectedOut && (
            <span className="text-[10px] text-base-content/40">
              out {expectedOut}
            </span>
          )}
        </div>
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu bg-base-200 rounded-box z-50 w-44 p-2 shadow-lg border border-base-300 mt-2"
      >
        <li>
          <button type="button" onClick={handleCheckOut} disabled={busy} className="text-error">
            <LogOut className="w-4 h-4" />
            Check Out
          </button>
        </li>
      </ul>
    </div>
  );
}

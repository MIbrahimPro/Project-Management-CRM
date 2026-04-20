"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, LogIn, LogOut, TrendingUp, Users } from "lucide-react";
import toast from "react-hot-toast";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type AttendanceStatus = "PRESENT" | "LATE" | "VERY_LATE" | "ABSENT" | "LEFT_EARLY";

const STATUS_BADGE: Record<AttendanceStatus, string> = {
  PRESENT: "badge-success",
  LATE: "badge-warning",
  VERY_LATE: "badge-error",
  ABSENT: "badge-neutral",
  LEFT_EARLY: "badge-info",
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  LATE: "Late",
  VERY_LATE: "Very Late",
  ABSENT: "Absent",
  LEFT_EARLY: "Left Early",
};

type CheckIn = {
  id: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  isAutoCheckout: boolean;
};

type AttendanceRecord = {
  id: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  user: { id: string; name: string };
};

type StatusData = {
  checkIn: CheckIn | null;
  attendance: { status: AttendanceStatus } | null;
  isCheckedIn: boolean;
};

const ATTENDANCE_ROLES = [
  "ADMIN", "PROJECT_MANAGER", "DEVELOPER", "DESIGNER", "HR", "ACCOUNTANT", "SALES",
];

import { MessageCircle, Search, Send, UserX } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";

export default function AttendancePage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [mgmtData, setMgmtData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [mgmtSearch, setMgmtSearch] = useState("");
  const [mgmtFilter, setMgmtFilter] = useState<"ALL" | "ABSENT" | "ACTIVE">("ALL");

  const isManager = ["ADMIN", "PROJECT_MANAGER"].includes(userRole);

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((userRes) => {
        const role = userRes.data?.role ?? "";
        setUserRole(role);
        
        const isManager = ["ADMIN", "PROJECT_MANAGER"].includes(role);
        const promises = [
          fetch("/api/attendance/status").then((r) => r.json()),
          fetch("/api/attendance").then((r) => r.json()),
        ];
        
        if (isManager) {
          promises.push(fetch("/api/attendance/management").then((r) => r.json()));
        }

        return Promise.all(promises);
      })
      .then(([statusRes, recordsRes, mgmtRes]: any[]) => {
        setStatus(statusRes.data);
        setRecords(recordsRes.data ?? []);
        if (mgmtRes) setMgmtData(mgmtRes.data ?? []);
      })
      .catch(() => toast.error("Failed to load attendance", { style: TOAST_ERROR_STYLE }))
      .finally(() => setLoading(false));
  }, []);

  async function handleCheckIn() {
    setCheckingIn(true);
    try {
      const res = await fetch("/api/attendance/check-in", { method: "POST" });
      const data = (await res.json()) as { data?: { id: string; checkedInAt: string; status: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Checked in!", { style: TOAST_STYLE });
      // Refresh status
      const updated = await fetch("/api/attendance/status").then((r) => r.json()) as { data: StatusData };
      setStatus(updated.data);
      const updatedRecords = await fetch("/api/attendance").then((r) => r.json()) as { data: AttendanceRecord[] };
      setRecords(updatedRecords.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to check in", { style: TOAST_ERROR_STYLE });
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleCheckOut() {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/attendance/check-out", { method: "POST" });
      const data = (await res.json()) as { data?: { checkedOutAt: string; leftEarly: boolean }; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(
        data.data?.leftEarly ? "Checked out (early)" : "Checked out!",
        { style: TOAST_STYLE }
      );
      const updated = await fetch("/api/attendance/status").then((r) => r.json()) as { data: StatusData };
      setStatus(updated.data);
      const updatedRecords = await fetch("/api/attendance").then((r) => r.json()) as { data: AttendanceRecord[] };
      setRecords(updatedRecords.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to check out", { style: TOAST_ERROR_STYLE });
    } finally {
      setCheckingOut(false);
    }
  }

  async function handlePing(targetUserId: string) {
    try {
      const res = await fetch("/api/attendance/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send ping");
      
      toast.success("Ping sent!", { style: TOAST_STYLE });
      // Refresh management data
      const mgmtRes = await fetch("/api/attendance/management").then((r) => r.json());
      setMgmtData(mgmtRes.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to ping", { style: TOAST_ERROR_STYLE });
    }
  }

  function formatDuration(inAt: string, outAt: string | null) {
    const start = new Date(inAt);
    const end = outAt ? new Date(outAt) : new Date();
    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const isAttendanceRole = ATTENDANCE_ROLES.includes(userRole);
  const thisMonthPresent = records.filter(
    (r) => r.status === "PRESENT" || r.status === "LATE"
  ).length;
  const thisMonthTotal = records.length;

  const filteredMgmt = mgmtData.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(mgmtSearch.toLowerCase()) || e.email.toLowerCase().includes(mgmtSearch.toLowerCase());
    if (!matchesSearch) return false;
    
    if (mgmtFilter === "ABSENT") return e.attendance?.[0]?.status === "ABSENT" || !e.attendance?.[0];
    if (mgmtFilter === "ACTIVE") return e.checkIns?.length > 0;
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  // Management View
  if (isManager) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-base-content">Attendance Management</h1>
            <p className="text-sm text-base-content/50 mt-0.5">
              Team overview for {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="join">
              <button 
                className={`join-item btn btn-sm ${mgmtFilter === "ALL" ? "btn-active" : ""}`}
                onClick={() => setMgmtFilter("ALL")}
              >
                All
              </button>
              <button 
                className={`join-item btn btn-sm ${mgmtFilter === "ACTIVE" ? "btn-active" : ""}`}
                onClick={() => setMgmtFilter("ACTIVE")}
              >
                Active
              </button>
              <button 
                className={`join-item btn btn-sm ${mgmtFilter === "ABSENT" ? "btn-active" : ""}`}
                onClick={() => setMgmtFilter("ABSENT")}
              >
                Absent
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
              <input 
                type="text" 
                placeholder="Search team..." 
                className="input input-sm input-bordered pl-9 w-48"
                value={mgmtSearch}
                onChange={(e) => setMgmtSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMgmt.map((e) => {
            const att = e.attendance?.[0];
            const active = e.checkIns?.[0];
            
            return (
              <div key={e.id} className="card bg-base-200 shadow-sm border border-base-300/50">
                <div className="card-body p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar 
                        user={{ name: e.name, profilePicUrl: e.avatarSignedUrl }} 
                        size={48} 
                        showPresence
                        isOnline={!!active}
                      />
                      <div>
                        <h3 className="font-semibold text-base-content leading-none">{e.name}</h3>
                        <p className="text-[10px] text-base-content/40 mt-1 uppercase tracking-wider">{e.role.replace("_", " ")}</p>
                      </div>
                    </div>
                    {att?.status && (
                      <span className={`badge badge-sm ${STATUS_BADGE[att.status as AttendanceStatus]}`}>
                        {STATUS_LABEL[att.status as AttendanceStatus]}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-base-content/40">Shift:</span>
                      <span className="font-medium">{e.workHoursStart} - {e.workHoursEnd}</span>
                    </div>
                    {active ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-base-content/40">Logged in:</span>
                        <span className="text-success font-medium">
                          {new Date(active.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-base-content/40">Last Action:</span>
                        <span className="text-base-content/30 italic">Not checked in</span>
                      </div>
                    )}
                  </div>

                  <div className="card-actions justify-end mt-4 pt-3 border-t border-base-300/30">
                    {!att && (
                      <button 
                        className={`btn btn-ghost btn-xs text-error gap-1 ${e.pings?.some((p: any) => p.status === "PENDING") ? "btn-disabled opacity-50" : ""}`}
                        onClick={() => {
                          if (e.pings?.some((p: any) => p.status === "PENDING")) return;
                          void handlePing(e.id);
                        }}
                      >
                        <Send className="w-3 h-3" />
                        {e.pings?.some((p: any) => p.status === "PENDING") ? "Pinged" : "Ping"}
                      </button>
                    )}
                    <button 
                      className="btn btn-ghost btn-xs text-primary gap-1"
                      onClick={() => {
                        window.location.href = `/chat?userId=${e.id}`;
                      }}
                    >
                      <MessageCircle className="w-3 h-3" />
                      Message
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredMgmt.length === 0 && (
          <div className="flex flex-col items-center py-24 text-base-content/20 gap-3">
            <UserX className="w-12 h-12" />
            <p>No team members found for this filter</p>
          </div>
        )}
      </div>
    );
  }

  // Employee View
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-base-content">My Attendance</h1>
        <p className="text-sm text-base-content/50 mt-0.5">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Check-in card */}
      {isAttendanceRole && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-semibold text-base-content">Today</h2>
                {status?.checkIn ? (
                  <div className="space-y-0.5 mt-1">
                    <div className="flex items-center gap-1.5 text-sm text-base-content/60">
                      <LogIn className="w-3.5 h-3.5" />
                      Checked in at {new Date(status.checkIn.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    {status.checkIn.checkedOutAt && (
                      <div className="flex items-center gap-1.5 text-sm text-base-content/60">
                        <LogOut className="w-3.5 h-3.5" />
                        Checked out at {new Date(status.checkIn.checkedOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {status.checkIn.isAutoCheckout && <span className="badge badge-xs badge-neutral">auto</span>}
                      </div>
                    )}
                    {status.checkIn && !status.checkIn.checkedOutAt && (
                      <div className="flex items-center gap-1.5 text-sm text-primary">
                        <Clock className="w-3.5 h-3.5" />
                        Duration: {formatDuration(status.checkIn.checkedInAt, null)}
                      </div>
                    )}
                    {status.checkIn?.checkedOutAt && (
                      <div className="flex items-center gap-1.5 text-sm text-base-content/60">
                        <Clock className="w-3.5 h-3.5" />
                        Total: {formatDuration(status.checkIn.checkedInAt, status.checkIn.checkedOutAt)}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-base-content/40 mt-1">Not checked in yet</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {status?.attendance && (
                  <span className={`badge ${STATUS_BADGE[status.attendance.status]}`}>
                    {STATUS_LABEL[status.attendance.status]}
                  </span>
                )}
                {status?.isCheckedIn ? (
                  <button
                    className="btn btn-neutral gap-2"
                    onClick={() => void handleCheckOut()}
                    disabled={checkingOut}
                  >
                    {checkingOut ? <span className="loading loading-spinner loading-sm" /> : <LogOut className="w-4 h-4" />}
                    Check Out
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    {status?.checkIn?.checkedOutAt && (
                      <span className="badge badge-success badge-sm">Session ended</span>
                    )}
                    <button
                      className="btn btn-primary gap-2"
                      onClick={() => void handleCheckIn()}
                      disabled={checkingIn}
                    >
                      {checkingIn ? <span className="loading loading-spinner loading-sm" /> : <LogIn className="w-4 h-4" />}
                      {status?.checkIn?.checkedOutAt ? "Check In Again" : "Check In"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4 gap-1">
            <div className="flex items-center gap-2 text-base-content/40">
              <Calendar className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Days Present</span>
            </div>
            <p className="text-2xl font-bold text-base-content">{thisMonthPresent}</p>
            <p className="text-xs text-base-content/40">of {thisMonthTotal} recorded</p>
          </div>
        </div>
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4 gap-1">
            <div className="flex items-center gap-2 text-base-content/40">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Attendance Rate</span>
            </div>
            <p className="text-2xl font-bold text-base-content">
              {thisMonthTotal > 0 ? Math.round((thisMonthPresent / thisMonthTotal) * 100) : 0}%
            </p>
            <p className="text-xs text-base-content/40">this period</p>
          </div>
        </div>
        <div className="card bg-base-200 shadow-sm col-span-2 md:col-span-1">
          <div className="card-body p-4 gap-1">
            <div className="flex items-center gap-2 text-base-content/40">
              <Users className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Late Days</span>
            </div>
            <p className="text-2xl font-bold text-base-content">
              {records.filter((r) => r.status === "LATE" || r.status === "VERY_LATE").length}
            </p>
            <p className="text-xs text-base-content/40">this period</p>
          </div>
        </div>
      </div>

      {/* Records table */}
      <div className="card bg-base-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-base-300">
          <h2 className="font-semibold text-base-content">History</h2>
        </div>
        {records.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-base-content/30 gap-2">
            <Calendar className="w-8 h-8 opacity-30" />
            <p className="text-sm">No attendance records yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr className="text-base-content/50">
                  <th>Date</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-base-300 transition-colors">
                    <td className="text-sm font-medium">
                      {new Date(r.date).toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                      })}
                    </td>
                    <td>
                      <span className={`badge badge-sm ${STATUS_BADGE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="text-xs text-base-content/50">{r.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

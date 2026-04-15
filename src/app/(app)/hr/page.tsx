"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Briefcase,
  ChevronRight,
  Clock,
  Plus,
  UserX,
  X,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type HiringRequest = {
  id: string;
  statedRole: string;
  role: string;
  status: string;
  publicSlug: string | null;
  publicTitle: string | null;
  deadline: string | null;
  requestedBy: { id: string; name: string };
  _count: { candidates: number };
};

type AttendanceAlert = {
  user: { id: string; name: string; role: string; profilePicUrl: string | null };
  alertType: "ABSENT" | "VERY_LATE";
  count: number;
  dates: string[];
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "badge-neutral",
  PENDING_APPROVAL: "badge-warning",
  OPEN: "badge-success",
  CLOSED: "badge-info",
  CANCELLED: "badge-error",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  DEVELOPER: "Developer",
  DESIGNER: "Designer",
  HR: "HR",
  ACCOUNTANT: "Accountant",
  SALES: "Sales",
  CLIENT: "Client",
};

export default function HRPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<HiringRequest[]>([]);
  const [alerts, setAlerts] = useState<AttendanceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // New request modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newStatedRole, setNewStatedRole] = useState("");
  const [newRole, setNewRole] = useState<string>("DEVELOPER");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/hr/requests").then((r) => r.json()),
      fetch("/api/hr/attendance-alerts").then((r) => r.json()),
    ])
      .then(([reqRes, alertRes]: [{ data: HiringRequest[] }, { data: AttendanceAlert[] }]) => {
        setRequests(reqRes.data ?? []);
        setAlerts(alertRes.data ?? []);
      })
      .catch(() => toast.error("Failed to load HR data", { style: TOAST_ERROR_STYLE }))
      .finally(() => setLoading(false));
  }, []);

  async function createRequest() {
    if (!newStatedRole.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/hr/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statedRole: newStatedRole.trim(), role: newRole }),
      });
      const data = (await res.json()) as { data?: HiringRequest; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Hiring request created", { style: TOAST_STYLE });
      setShowNewModal(false);
      setNewStatedRole("");
      router.push(`/hr/${data.data!.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const pipeline = {
    DRAFT: requests.filter((r) => r.status === "DRAFT").length,
    PENDING_APPROVAL: requests.filter((r) => r.status === "PENDING_APPROVAL").length,
    OPEN: requests.filter((r) => r.status === "OPEN").length,
    CLOSED: requests.filter((r) => r.status === "CLOSED").length,
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-base-content">HR & Hiring</h1>
            <p className="text-sm text-base-content/50 mt-0.5">Manage hiring requests and team attendance</p>
          </div>
          <button
            className="btn btn-primary btn-sm gap-2"
            onClick={() => setShowNewModal(true)}
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        </div>

        {/* Pipeline Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Draft", key: "DRAFT", color: "text-base-content/60" },
            { label: "Pending Approval", key: "PENDING_APPROVAL", color: "text-warning" },
            { label: "Open", key: "OPEN", color: "text-success" },
            { label: "Closed", key: "CLOSED", color: "text-info" },
          ].map(({ label, key, color }) => (
            <div key={key} className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <Briefcase className={`w-5 h-5 mb-1 ${color}`} />
                <p className="text-xs text-base-content/50">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{pipeline[key as keyof typeof pipeline]}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hiring Requests List */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="font-semibold text-base-content">Hiring Requests</h2>
            {requests.length === 0 ? (
              <div className="card bg-base-200 shadow-sm">
                <div className="card-body items-center py-10 text-base-content/40">
                  <Briefcase className="w-10 h-10 opacity-30 mb-2" />
                  <p className="text-sm">No hiring requests yet</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map((r) => (
                  <button
                    key={r.id}
                    className="w-full card bg-base-200 hover:bg-base-300 transition-colors text-left shadow-sm"
                    onClick={() => router.push(`/hr/${r.id}`)}
                  >
                    <div className="card-body p-4 flex-row items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-base-content text-sm">
                            {r.publicTitle ?? r.statedRole}
                          </span>
                          <span className={`badge badge-sm ${STATUS_BADGE[r.status] ?? "badge-neutral"}`}>
                            {r.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-base-content/50">
                          <span>{ROLE_LABELS[r.role] ?? r.role}</span>
                          <span>·</span>
                          <span>{r._count.candidates} candidate{r._count.candidates !== 1 ? "s" : ""}</span>
                          {r.deadline && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(r.deadline).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-base-content/30 flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Attendance Alerts */}
          <div className="space-y-3">
            <h2 className="font-semibold text-base-content flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Attendance Alerts
            </h2>
            {alerts.length === 0 ? (
              <div className="card bg-base-200 shadow-sm">
                <div className="card-body items-center py-8 text-base-content/40">
                  <p className="text-sm">No alerts this week</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div key={i} className="card bg-base-200 shadow-sm">
                    <div className="card-body p-4 gap-2">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                          a.alertType === "ABSENT" ? "bg-error/20 text-error" : "bg-warning/20 text-warning"
                        }`}>
                          {a.alertType === "ABSENT" ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-base-content">{a.user.name}</p>
                          <p className="text-xs text-base-content/50">
                            {a.alertType === "ABSENT"
                              ? `Absent ${a.count} day${a.count !== 1 ? "s" : ""} this week`
                              : `Very late ${a.count} time${a.count !== 1 ? "s" : ""} this week`}
                          </p>
                          <p className="text-xs text-base-content/40 mt-0.5">
                            {a.dates.slice(0, 3).join(", ")}
                            {a.dates.length > 3 && ` +${a.dates.length - 3} more`}
                          </p>
                        </div>
                        <span className={`badge badge-sm ${a.alertType === "ABSENT" ? "badge-error" : "badge-warning"}`}>
                          {a.alertType === "ABSENT" ? "Absent" : "Very Late"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Request Modal */}
      <dialog className={`modal ${showNewModal ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">New Hiring Request</h3>
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setShowNewModal(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="form-control gap-1">
              <label className="label py-0">
                <span className="label-text">Position Title</span>
              </label>
              <input
                type="text"
                className="input input-bordered bg-base-100"
                placeholder="e.g. Senior React Developer"
                value={newStatedRole}
                onChange={(e) => setNewStatedRole(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void createRequest()}
              />
            </div>
            <div className="form-control gap-1">
              <label className="label py-0">
                <span className="label-text">System Role</span>
              </label>
              <select
                className="select select-bordered bg-base-100"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="PROJECT_MANAGER">Project Manager</option>
                <option value="DEVELOPER">Developer</option>
                <option value="DESIGNER">Designer</option>
                <option value="HR">HR</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="SALES">Sales</option>
              </select>
            </div>
          </div>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setShowNewModal(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => void createRequest()}
              disabled={creating || !newStatedRole.trim()}
            >
              {creating && <span className="loading loading-spinner loading-sm" />}
              Create
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setShowNewModal(false)} />
      </dialog>

      {/* Placeholder to avoid unused import warning */}
      <span className="hidden"><Zap /></span>
    </>
  );
}

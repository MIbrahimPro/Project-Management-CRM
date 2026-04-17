"use client";

import { useEffect, useState } from "react";
import { Briefcase, CheckCircle, Clock, RefreshCw, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import toast from "react-hot-toast";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type HiringRequest = {
  id: string;
  statedRole: string;
  publicTitle: string | null;
  status: string;
  managerApproved: boolean;
  hrApproved: boolean;
  adminApproved: boolean;
  createdAt: string;
  deadline: string | null;
  _count: { candidates: number };
  requestedBy: { id: string; name: string; role: string };
  hr: { id: string; name: string } | null;
};

function ApprovalChip({ label, approved }: { label: string; approved: boolean }) {
  return (
    <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
      approved ? "bg-success/20 text-success" : "bg-base-300 text-base-content/40"
    }`}>
      {approved ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {label}
    </div>
  );
}

export default function AdminHiringPage() {
  const [requests, setRequests] = useState<HiringRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/admin/hiring-approvals")
      .then((r) => r.json())
      .then((d: { data: HiringRequest[] }) => setRequests(d.data ?? []))
      .catch(() => toast.error("Failed to load", { style: TOAST_ERROR_STYLE }))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function setApproval(id: string, approved: boolean) {
    setApproving(id);
    try {
      const res = await fetch(`/api/admin/hiring-approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminApproved: approved }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(approved ? "Approved" : "Rejected", { style: TOAST_STYLE });
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, adminApproved: approved } : r))
      );
      // Remove from list if approved (no longer pending)
      if (approved) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      toast.error("Failed to update", { style: TOAST_ERROR_STYLE });
    } finally {
      setApproving(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-base-content">Hiring Approvals</h1>
          <p className="text-sm text-base-content/50 mt-0.5">
            Requests pending admin approval
          </p>
        </div>
        <button className="btn btn-ghost btn-sm gap-1" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body items-center py-16 text-base-content/30 gap-3">
            <CheckCircle className="w-12 h-12 opacity-20" />
            <p>No pending hiring requests</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="card bg-base-200 shadow-sm">
              <div className="card-body p-5 gap-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-base-content">
                        {r.publicTitle ?? r.statedRole}
                      </h3>
                      <span className="badge badge-xs badge-neutral">{r.status}</span>
                    </div>
                    <div className="text-xs text-base-content/50 flex items-center gap-3">
                      <span>Requested by <strong>{r.requestedBy.name}</strong> ({r.requestedBy.role.replace(/_/g, " ")})</span>
                      {r.hr && <span>HR: <strong>{r.hr.name}</strong></span>}
                      {r.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Deadline: {new Date(r.deadline).toLocaleDateString()}
                        </span>
                      )}
                      <span>{r._count.candidates} candidate{r._count.candidates !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-error btn-sm gap-1"
                      onClick={() => void setApproval(r.id, false)}
                      disabled={approving === r.id}
                    >
                      {approving === r.id ? <span className="loading loading-spinner loading-xs" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                      Reject
                    </button>
                    <button
                      className="btn btn-success btn-sm gap-1"
                      onClick={() => void setApproval(r.id, true)}
                      disabled={approving === r.id}
                    >
                      {approving === r.id ? <span className="loading loading-spinner loading-xs" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                  </div>
                </div>

                {/* Approval status chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-base-content/40">Approvals:</span>
                  <ApprovalChip label="Manager" approved={r.managerApproved} />
                  <ApprovalChip label="HR" approved={r.hrApproved} />
                  <ApprovalChip label="Admin" approved={r.adminApproved} />
                </div>

                <p className="text-xs text-base-content/30">
                  Submitted {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

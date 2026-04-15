"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle, Key, MoreVertical, Plus, RefreshCw, Search,
  ShieldOff, Trash2, UserCheck, UserX, X,
} from "lucide-react";
import toast from "react-hot-toast";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

const ROLES = [
  "ADMIN", "PROJECT_MANAGER", "DEVELOPER", "DESIGNER",
  "HR", "ACCOUNTANT", "SALES", "CLIENT",
] as const;
const WORK_MODES = ["REMOTE", "ONSITE", "HYBRID"] as const;

function pmCannotManageUser(viewerRole: string | null, targetRole: string): boolean {
  return viewerRole === "PROJECT_MANAGER" && (targetRole === "SUPER_ADMIN" || targetRole === "ADMIN");
}

function assignableRolesForViewer(viewerRole: string | null): readonly string[] {
  if (viewerRole === "PROJECT_MANAGER") {
    return ROLES.filter((r) => r !== "ADMIN");
  }
  return ROLES;
}

type User = {
  id: string; name: string; email: string; role: string;
  workMode: string; statedRole: string | null; isActive: boolean;
  createdAt: string; _count: { sessions: number };
  workHoursStart?: string | null; workHoursEnd?: string | null;
};

type Session = {
  id: string; userAgentFamily: string; ipAddress: string;
  lastUsedAt: string; expiresAt: string;
};

type UserDetail = User & { sessions: Session[] };

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: "badge-error", ADMIN: "badge-warning", PROJECT_MANAGER: "badge-info",
  DEVELOPER: "badge-primary", DESIGNER: "badge-secondary", HR: "badge-accent",
  ACCOUNTANT: "badge-neutral", SALES: "badge-success", CLIENT: "badge-ghost",
};

export default function AdminUsersPage() {
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit modal state
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editWorkMode, setEditWorkMode] = useState("");
  const [editStatedRole, setEditStatedRole] = useState("");
  const [editWorkStart, setEditWorkStart] = useState("");
  const [editWorkEnd, setEditWorkEnd] = useState("");
  const [saving, setSaving] = useState(false);

  // Create user modal
  const [createModal, setCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<string>("DEVELOPER");
  const [createWorkMode, setCreateWorkMode] = useState<string>("REMOTE");
  const [createStatedRole, setCreateStatedRole] = useState("");
  const [creating, setCreating] = useState(false);

  function loadUsers(q = search) {
    setLoading(true);
    fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => r.json())
      .then((d: { data: User[] }) => setUsers(d.data ?? []))
      .catch(() => toast.error("Failed to load users", { style: TOAST_ERROR_STYLE }))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { data?: { role: string } }) => setViewerRole(d.data?.role ?? null))
      .catch(() => setViewerRole(null));
  }, []);

  useEffect(() => { loadUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (viewerRole === "PROJECT_MANAGER" && createRole === "ADMIN") {
      setCreateRole("DEVELOPER");
    }
  }, [viewerRole, createRole]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => loadUsers(search), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDetail(userId: string) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      const d = (await res.json()) as { data: UserDetail };
      setSelected(d.data);
    } finally {
      setLoadingDetail(false);
    }
  }

  function openEdit(u: User) {
    if (pmCannotManageUser(viewerRole, u.role)) {
      toast.error("Only administrators can change administrator accounts", { style: TOAST_ERROR_STYLE });
      return;
    }
    setEditName(u.name);
    setEditRole(u.role);
    setEditWorkMode(u.workMode);
    setEditStatedRole(u.statedRole ?? "");
    setEditWorkStart(u.workHoursStart ?? "");
    setEditWorkEnd(u.workHoursEnd ?? "");
    setEditModal(true);
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName, role: editRole, workMode: editWorkMode,
          statedRole: editStatedRole || null,
          workHoursStart: editWorkStart || null,
          workHoursEnd: editWorkEnd || null,
        }),
      });
      const d = (await res.json()) as { data?: User; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast.success("User updated", { style: TOAST_STYLE });
      setEditModal(false);
      setUsers((prev) => prev.map((u) => (u.id === selected.id ? { ...u, ...d.data } : u)));
      setSelected((prev) => prev ? { ...prev, ...d.data } : prev);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User) {
    if (pmCannotManageUser(viewerRole, u.role)) {
      toast.error("Only administrators can change administrator accounts", { style: TOAST_ERROR_STYLE });
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      const next = !u.isActive;
      toast.success(next ? "User activated" : "User deactivated", { style: TOAST_STYLE });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: next } : x)));
      setSelected((prev) => prev?.id === u.id ? { ...prev, isActive: next } : prev);
    } catch {
      toast.error("Failed", { style: TOAST_ERROR_STYLE });
    }
  }

  async function sendPasswordReset(userId: string, userName: string, targetRole: string) {
    if (pmCannotManageUser(viewerRole, targetRole)) {
      toast.error("Only administrators can change administrator accounts", { style: TOAST_ERROR_STYLE });
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Reset email sent to ${userName}`, { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to send reset email", { style: TOAST_ERROR_STYLE });
    }
  }

  async function killSession(userId: string, sessionId: string, targetRole: string) {
    if (pmCannotManageUser(viewerRole, targetRole)) {
      toast.error("Only administrators can change administrator accounts", { style: TOAST_ERROR_STYLE });
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}/sessions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Session killed", { style: TOAST_STYLE });
      setSelected((prev) =>
        prev ? { ...prev, sessions: prev.sessions.filter((s) => s.id !== sessionId) } : prev
      );
    } catch {
      toast.error("Failed", { style: TOAST_ERROR_STYLE });
    }
  }

  async function killAllSessions(userId: string, targetRole: string) {
    if (pmCannotManageUser(viewerRole, targetRole)) {
      toast.error("Only administrators can change administrator accounts", { style: TOAST_ERROR_STYLE });
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}/sessions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("All sessions killed", { style: TOAST_STYLE });
      setSelected((prev) => prev ? { ...prev, sessions: [] } : prev);
    } catch {
      toast.error("Failed", { style: TOAST_ERROR_STYLE });
    }
  }

  async function createUser() {
    if (!createName.trim() || !createEmail.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users/create-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(), email: createEmail.trim(),
          role: createRole, workMode: createWorkMode,
          statedRole: createStatedRole.trim() || undefined,
        }),
      });
      const d = (await res.json()) as { data?: User; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast.success("User created & credentials emailed", { style: TOAST_STYLE });
      setCreateModal(false);
      setCreateName(""); setCreateEmail(""); setCreateRole("DEVELOPER");
      setCreateWorkMode("REMOTE"); setCreateStatedRole("");
      loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="flex gap-5 h-full" style={{ minHeight: "calc(100vh - 80px)" }}>
        {/* Users list */}
        <div className={`flex flex-col gap-4 ${selected ? "hidden lg:flex lg:w-[400px] flex-shrink-0" : "flex-1"}`}>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold text-base-content">Users</h1>
            <button className="btn btn-primary btn-sm gap-1" onClick={() => setCreateModal(true)}>
              <Plus className="w-4 h-4" /> Add User
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 input input-bordered bg-base-200">
            <Search className="w-4 h-4 text-base-content/30 flex-shrink-0" />
            <input
              className="flex-1 bg-transparent outline-none text-sm"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X className="w-3.5 h-3.5 text-base-content/30" />
              </button>
            )}
          </div>

          {/* Table */}
          <div className="card bg-base-200 overflow-hidden flex-1">
            {loading ? (
              <div className="flex justify-center py-8"><span className="loading loading-spinner text-primary" /></div>
            ) : (
              <div className="overflow-y-auto">
                <table className="table table-sm">
                  <thead>
                    <tr className="text-base-content/50">
                      <th>User</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className={`hover:bg-base-300 cursor-pointer transition-colors ${
                          selected?.id === u.id ? "bg-primary/10" : ""
                        }`}
                        onClick={() => { void loadDetail(u.id); }}
                      >
                        <td>
                          <div>
                            <p className="text-sm font-medium text-base-content">{u.name}</p>
                            <p className="text-xs text-base-content/40">{u.email}</p>
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge-xs ${ROLE_BADGE[u.role] ?? "badge-neutral"}`}>
                            {u.role.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-xs ${u.isActive ? "badge-success" : "badge-error"}`}>
                            {u.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-xs text-base-content/50">{u._count.sessions}</td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-base-content/30 py-8 text-sm">
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* User detail panel */}
        {selected && (
          <div className="flex-1 min-w-0 space-y-4">
            {/* Detail header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <button
                  className="btn btn-ghost btn-sm lg:hidden"
                  onClick={() => setSelected(null)}
                >
                  ← Back
                </button>
                <div>
                  <h2 className="text-lg font-semibold text-base-content">{selected.name}</h2>
                  <p className="text-sm text-base-content/40">{selected.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm gap-1"
                  disabled={pmCannotManageUser(viewerRole, selected.role)}
                  title={pmCannotManageUser(viewerRole, selected.role) ? "Administrator accounts can only be changed by admins" : undefined}
                  onClick={() => openEdit(selected)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm gap-1"
                  disabled={pmCannotManageUser(viewerRole, selected.role)}
                  title={pmCannotManageUser(viewerRole, selected.role) ? "Administrator accounts can only be changed by admins" : undefined}
                  onClick={() => void sendPasswordReset(selected.id, selected.name, selected.role)}
                >
                  <Key className="w-3.5 h-3.5" /> Reset Password
                </button>
                <button
                  type="button"
                  className={`btn btn-sm gap-1 ${selected.isActive ? "btn-error" : "btn-success"}`}
                  disabled={pmCannotManageUser(viewerRole, selected.role)}
                  title={pmCannotManageUser(viewerRole, selected.role) ? "Administrator accounts can only be changed by admins" : undefined}
                  onClick={() => void toggleActive(selected)}
                >
                  {selected.isActive ? (
                    <><UserX className="w-3.5 h-3.5" /> Deactivate</>
                  ) : (
                    <><UserCheck className="w-3.5 h-3.5" /> Activate</>
                  )}
                </button>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Role", value: selected.role.replace(/_/g, " ") },
                { label: "Work Mode", value: selected.workMode.replace(/_/g, " ") },
                { label: "Stated Role", value: selected.statedRole ?? "—" },
                { label: "Member Since", value: new Date(selected.createdAt).toLocaleDateString() },
                {
                  label: "Work Hours",
                  value:
                    selected.workHoursStart && selected.workHoursEnd
                      ? `${selected.workHoursStart} – ${selected.workHoursEnd}`
                      : "—",
                },
              ].map(({ label, value }) => (
                <div key={label} className="bg-base-200 rounded-xl p-3">
                  <p className="text-xs text-base-content/40 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-medium text-base-content mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Sessions */}
            <div className="card bg-base-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
                <h3 className="font-semibold text-base-content text-sm">
                  Active Sessions ({selected.sessions.length})
                </h3>
                {selected.sessions.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-error btn-xs gap-1"
                    disabled={pmCannotManageUser(viewerRole, selected.role)}
                    title={pmCannotManageUser(viewerRole, selected.role) ? "Administrator accounts can only be changed by admins" : undefined}
                    onClick={() => void killAllSessions(selected.id, selected.role)}
                  >
                    <Trash2 className="w-3 h-3" /> Kill All
                  </button>
                )}
              </div>
              {selected.sessions.length === 0 ? (
                <p className="text-center text-base-content/30 text-sm py-6">No active sessions</p>
              ) : (
                <div className="divide-y divide-base-300">
                  {selected.sessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="text-xs space-y-0.5">
                        <p className="text-base-content/70">{s.userAgentFamily} · {s.ipAddress}</p>
                        <p className="text-base-content/30">
                          Last used: {new Date(s.lastUsedAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        disabled={pmCannotManageUser(viewerRole, selected.role)}
                        title={pmCannotManageUser(viewerRole, selected.role) ? "Administrator accounts can only be changed by admins" : undefined}
                        onClick={() => void killSession(selected.id, s.id, selected.role)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      <dialog className={`modal ${editModal ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">Edit User</h3>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setEditModal(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text">Name</span></label>
              <input className="input input-bordered bg-base-100" value={editName}
                onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text">Role</span></label>
                <select className="select select-bordered select-sm bg-base-100" value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}>
                  {assignableRolesForViewer(viewerRole).map((r) => (
                    <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text">Work Mode</span></label>
                <select className="select select-bordered select-sm bg-base-100" value={editWorkMode}
                  onChange={(e) => setEditWorkMode(e.target.value)}>
                  {WORK_MODES.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text">Stated Role (optional)</span></label>
              <input className="input input-bordered input-sm bg-base-100"
                placeholder="e.g. Senior Frontend Developer"
                value={editStatedRole} onChange={(e) => setEditStatedRole(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text">Work Start</span></label>
                <input
                  type="time"
                  className="input input-bordered input-sm bg-base-100"
                  value={editWorkStart}
                  onChange={(e) => setEditWorkStart(e.target.value)}
                />
              </div>
              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text">Work End</span></label>
                <input
                  type="time"
                  className="input input-bordered input-sm bg-base-100"
                  value={editWorkEnd}
                  onChange={(e) => setEditWorkEnd(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-base-content/40 -mt-1">
              Used for attendance late/on-time calculations. Leave empty to disable tracking.
            </p>
          </div>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setEditModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void saveEdit()} disabled={saving}>
              {saving && <span className="loading loading-spinner loading-sm" />}
              Save Changes
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setEditModal(false)} />
      </dialog>

      {/* Create user modal */}
      <dialog className={`modal ${createModal ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">Add User</h3>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setCreateModal(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-control gap-1 col-span-2">
                <label className="label py-0"><span className="label-text">Full Name</span></label>
                <input className="input input-bordered bg-base-100" placeholder="Jane Smith"
                  value={createName} onChange={(e) => setCreateName(e.target.value)} autoFocus />
              </div>
              <div className="form-control gap-1 col-span-2">
                <label className="label py-0"><span className="label-text">Email</span></label>
                <input className="input input-bordered bg-base-100" type="email" placeholder="jane@example.com"
                  value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} />
              </div>
              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text">Role</span></label>
                <select className="select select-bordered select-sm bg-base-100" value={createRole}
                  onChange={(e) => setCreateRole(e.target.value)}>
                  {assignableRolesForViewer(viewerRole).map((r) => (
                    <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text">Work Mode</span></label>
                <select className="select select-bordered select-sm bg-base-100" value={createWorkMode}
                  onChange={(e) => setCreateWorkMode(e.target.value)}>
                  {WORK_MODES.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div className="form-control gap-1 col-span-2">
                <label className="label py-0"><span className="label-text">Stated Role (optional)</span></label>
                <input className="input input-bordered input-sm bg-base-100" placeholder="e.g. Backend Developer"
                  value={createStatedRole} onChange={(e) => setCreateStatedRole(e.target.value)} />
              </div>
            </div>
            <div className="alert bg-base-300 border-base-300 text-xs text-base-content/60 py-2">
              A secure password will be auto-generated and emailed to the user.
            </div>
          </div>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setCreateModal(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => void createUser()}
              disabled={creating || !createName.trim() || !createEmail.trim()}
            >
              {creating && <span className="loading loading-spinner loading-sm" />}
              Create & Send Email
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setCreateModal(false)} />
      </dialog>
    </>
  );
}

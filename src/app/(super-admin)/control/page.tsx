"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Database,
  Key,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Shield,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

// ─── Types ─────────────────────────────────────────────────────────────────

type SystemConfig = { id: string; key: string; value: string; label: string; updatedAt: string };
type AuditLog = {
  id: string; userId: string | null; action: string; entity: string;
  entityId: string | null; metadata: unknown; ipAddress: string | null; createdAt: string;
};
type Session = {
  id: string; deviceId: string; userAgentFamily: string; userAgent: string;
  ipAddress: string; createdAt: string; lastUsedAt: string; expiresAt: string;
  user: { id: string; name: string; email: string; role: string };
};
type BlacklistData = {
  totalCount: number; activeCount: number; expiredCount: number;
  theftAttempts: { id: string; userId: string; blacklistedAt: string; graceUntil: string; expiresAt: string }[];
};
type DbStat = { table: string; count: number };
type SearchUser = { id: string; name: string; email: string; role: string };

type Section = "config" | "audit" | "sessions" | "blacklist" | "push" | "db";

// ─── Helpers ────────────────────────────────────────────────────────────────

function SectionTab({ id, label, icon: Icon, active, onClick }: {
  id: Section; label: string; icon: React.ElementType; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-primary text-primary-content" : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ─── System Config Section ───────────────────────────────────────────────────

function SystemConfigSection() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/super-admin/system-config")
      .then((r) => r.json())
      .then((d: { data: SystemConfig[] }) => {
        setConfigs(d.data ?? []);
        const vals: Record<string, string> = {};
        (d.data ?? []).forEach((c) => { vals[c.key] = c.value; });
        setEditValues(vals);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(key: string) {
    setSaving((p) => ({ ...p, [key]: true }));
    try {
      const res = await fetch("/api/super-admin/system-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: editValues[key] }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Saved ${key}`, { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to save", { style: TOAST_ERROR_STYLE });
    } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  }

  if (loading) return <div className="flex justify-center py-8"><span className="loading loading-spinner text-primary" /></div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-base-content/50">Edit system-wide configuration values. Changes take effect immediately.</p>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr className="text-base-content/50">
              <th>Key</th>
              <th>Label</th>
              <th>Value</th>
              <th>Last Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {configs.map((c) => (
              <tr key={c.key} className="hover:bg-base-200 transition-colors">
                <td className="font-mono text-xs text-primary">{c.key}</td>
                <td className="text-sm text-base-content/70">{c.label}</td>
                <td>
                  <input
                    className="input input-bordered input-sm bg-base-100 w-40"
                    value={editValues[c.key] ?? ""}
                    onChange={(e) => setEditValues((p) => ({ ...p, [c.key]: e.target.value }))}
                  />
                </td>
                <td className="text-xs text-base-content/40">
                  {new Date(c.updatedAt).toLocaleDateString()}
                </td>
                <td>
                  <button
                    className="btn btn-primary btn-xs gap-1"
                    onClick={() => void save(c.key)}
                    disabled={saving[c.key] || editValues[c.key] === c.value}
                  >
                    {saving[c.key] ? <span className="loading loading-spinner loading-xs" /> : <Save className="w-3 h-3" />}
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Audit Logs Section ──────────────────────────────────────────────────────

function AuditLogsSection() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(() => {
    const params = new URLSearchParams();
    if (filterAction) params.set("action", filterAction);
    if (filterEntity) params.set("entity", filterEntity);
    fetch(`/api/super-admin/audit-logs?${params}`)
      .then((r) => r.json())
      .then((d: { data: AuditLog[] }) => setLogs(d.data ?? []))
      .finally(() => setLoading(false));
  }, [filterAction, filterEntity]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => void fetchLogs(), 30000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchLogs]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          className="input input-bordered input-sm bg-base-100 w-40"
          placeholder="Filter action…"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        />
        <input
          className="input input-bordered input-sm bg-base-100 w-40"
          placeholder="Filter entity…"
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value)}
        />
        <button className="btn btn-ghost btn-sm gap-1" onClick={() => void fetchLogs()}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          <span className="text-sm text-base-content/60">Auto-refresh (30s)</span>
        </label>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><span className="loading loading-spinner text-primary" /></div>
      ) : (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="table table-xs">
            <thead className="sticky top-0 bg-base-100 z-10">
              <tr className="text-base-content/50">
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-base-200 transition-colors">
                  <td className="text-xs text-base-content/40 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="text-xs font-mono text-base-content/60">{log.userId?.slice(0, 8) ?? "—"}</td>
                  <td>
                    <span className="badge badge-xs badge-neutral font-mono">{log.action}</span>
                  </td>
                  <td className="text-xs text-primary">{log.entity}</td>
                  <td className="text-xs font-mono text-base-content/40">{log.entityId?.slice(0, 8) ?? "—"}</td>
                  <td className="text-xs text-base-content/40">{log.ipAddress ?? "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-base-content/30 py-8 text-sm">No logs found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-base-content/40">Showing last {logs.length} of 200 max</p>
    </div>
  );
}

// ─── Sessions Section ────────────────────────────────────────────────────────

function SessionsSection() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [killing, setKilling] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/super-admin/sessions")
      .then((r) => r.json())
      .then((d: { data: Session[] }) => setSessions(d.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function killSession(sessionId: string) {
    setKilling(sessionId);
    try {
      const res = await fetch("/api/super-admin/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error("Failed");
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success("Session killed", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to kill session", { style: TOAST_ERROR_STYLE });
    } finally {
      setKilling(null);
    }
  }

  async function killAll(userId: string, userName: string) {
    setKilling(`all-${userId}`);
    try {
      const res = await fetch("/api/super-admin/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json()) as { data?: { killed: number } };
      if (!res.ok) throw new Error("Failed");
      setSessions((prev) => prev.filter((s) => s.user.id !== userId));
      toast.success(`Killed ${data.data?.killed ?? 0} sessions for ${userName}`, { style: TOAST_STYLE });
    } catch {
      toast.error("Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setKilling(null);
    }
  }

  // Group by user
  const byUser = sessions.reduce<Record<string, { user: Session["user"]; sessions: Session[] }>>(
    (acc, s) => {
      if (!acc[s.user.id]) acc[s.user.id] = { user: s.user, sessions: [] };
      acc[s.user.id]!.sessions.push(s);
      return acc;
    },
    {}
  );

  if (loading) return <div className="flex justify-center py-8"><span className="loading loading-spinner text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-base-content/50">{sessions.length} active session{sessions.length !== 1 ? "s" : ""}</p>
        <button className="btn btn-ghost btn-sm gap-1" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>
      {Object.values(byUser).map(({ user, sessions: userSessions }) => (
        <div key={user.id} className="bg-base-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-base-300">
            <div>
              <span className="font-medium text-sm text-base-content">{user.name}</span>
              <span className="text-xs text-base-content/40 ml-2">{user.email}</span>
              <span className="badge badge-xs badge-neutral ml-2">{user.role}</span>
            </div>
            <button
              className="btn btn-error btn-xs gap-1"
              onClick={() => void killAll(user.id, user.name)}
              disabled={killing === `all-${user.id}`}
            >
              {killing === `all-${user.id}` ? <span className="loading loading-spinner loading-xs" /> : <Trash2 className="w-3 h-3" />}
              Kill all ({userSessions.length})
            </button>
          </div>
          <div className="divide-y divide-base-300">
            {userSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base-content/60">{s.userAgentFamily}</span>
                    <span className="text-base-content/30">·</span>
                    <span className="text-base-content/40">{s.ipAddress}</span>
                  </div>
                  <div className="text-base-content/30">
                    Last used: {new Date(s.lastUsedAt).toLocaleString()} · Expires: {new Date(s.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-xs text-error"
                  onClick={() => void killSession(s.id)}
                  disabled={killing === s.id}
                >
                  {killing === s.id ? <span className="loading loading-spinner loading-xs" /> : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {sessions.length === 0 && (
        <p className="text-center text-base-content/30 text-sm py-8">No active sessions</p>
      )}
    </div>
  );
}

// ─── Blacklist Monitor Section ────────────────────────────────────────────────

function BlacklistSection() {
  const [data, setData] = useState<BlacklistData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/super-admin/blacklist")
      .then((r) => r.json())
      .then((d: { data: BlacklistData }) => setData(d.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><span className="loading loading-spinner text-primary" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Blacklisted", value: data.totalCount, color: "text-base-content" },
          { label: "Active (not expired)", value: data.activeCount, color: "text-warning" },
          { label: "Expired", value: data.expiredCount, color: "text-base-content/40" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-base-200 rounded-xl p-4">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-base-content/40 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-base-content mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-error" />
          Suspected Token Theft ({data.theftAttempts.length})
        </h3>
        {data.theftAttempts.length === 0 ? (
          <p className="text-sm text-base-content/30">No theft attempts detected</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-xs">
              <thead>
                <tr className="text-base-content/50">
                  <th>User ID</th>
                  <th>Detected At</th>
                  <th>Grace Until</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {data.theftAttempts.map((t) => (
                  <tr key={t.id} className="text-error/80">
                    <td className="font-mono text-xs">{t.userId.slice(0, 12)}…</td>
                    <td className="text-xs">{new Date(t.blacklistedAt).toLocaleString()}</td>
                    <td className="text-xs">{new Date(t.graceUntil).toLocaleString()}</td>
                    <td className="text-xs">{new Date(t.expiresAt).toLocaleDateString()}</td>
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

// ─── Push Test Section ────────────────────────────────────────────────────────

function PushTestSection() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [title, setTitle] = useState("Test Notification");
  const [body, setBody] = useState("This is a test push notification from Super Admin.");
  const [sending, setSending] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      fetch(`/api/users?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d: { data: SearchUser[] }) => setResults(d.data ?? []))
        .finally(() => setSearching(false));
    }, 300);
  }, [query]);

  async function sendPush() {
    if (!selectedUser) return;
    setSending(true);
    try {
      const res = await fetch("/api/super-admin/push-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, title, body }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Push sent to ${selectedUser.name}`, { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to send push", { style: TOAST_ERROR_STYLE });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4 max-w-md">
      <p className="text-sm text-base-content/50">Send a test push notification to any user to verify their subscription is active.</p>

      {/* User search */}
      <div className="form-control gap-1">
        <label className="label py-0"><span className="label-text">Select User</span></label>
        {selectedUser ? (
          <div className="flex items-center justify-between bg-base-200 rounded-xl px-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-base-content">{selectedUser.name}</p>
              <p className="text-xs text-base-content/40">{selectedUser.email}</p>
            </div>
            <button className="btn btn-ghost btn-xs" onClick={() => { setSelectedUser(null); setQuery(""); }}>
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-2 input input-bordered bg-base-100">
              <Search className="w-4 h-4 text-base-content/30 flex-shrink-0" />
              <input
                className="flex-1 bg-transparent outline-none text-sm"
                placeholder="Search by name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {searching && <span className="loading loading-spinner loading-xs text-primary" />}
            </div>
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 bg-base-200 border border-base-300 rounded-xl shadow-xl mt-1 overflow-hidden">
                {results.map((u) => (
                  <button
                    key={u.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-base-300 transition-colors"
                    onClick={() => { setSelectedUser(u); setQuery(""); setResults([]); }}
                  >
                    <p className="text-sm font-medium text-base-content">{u.name}</p>
                    <p className="text-xs text-base-content/40">{u.email} · {u.role}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="form-control gap-1">
        <label className="label py-0"><span className="label-text">Title</span></label>
        <input
          className="input input-bordered bg-base-100"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="form-control gap-1">
        <label className="label py-0"><span className="label-text">Body</span></label>
        <textarea
          className="textarea textarea-bordered bg-base-100"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <button
        className="btn btn-primary gap-2"
        onClick={() => void sendPush()}
        disabled={!selectedUser || !title.trim() || !body.trim() || sending}
      >
        {sending ? <span className="loading loading-spinner loading-sm" /> : <Send className="w-4 h-4" />}
        Send Push
      </button>
    </div>
  );
}

// ─── DB Stats Section ─────────────────────────────────────────────────────────

function DbStatsSection() {
  const [stats, setStats] = useState<DbStat[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/super-admin/db-stats")
      .then((r) => r.json())
      .then((d: { data: DbStat[] }) => setStats(d.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-8"><span className="loading loading-spinner text-primary" /></div>;

  const total = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-base-content/50">{total.toLocaleString()} total rows across {stats.length} tables</p>
        <button className="btn btn-ghost btn-sm gap-1" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {stats
          .sort((a, b) => b.count - a.count)
          .map((s) => (
            <div key={s.table} className="bg-base-200 rounded-xl p-4">
              <p className="text-xl font-bold text-base-content">{s.count.toLocaleString()}</p>
              <p className="text-xs text-base-content/40 mt-0.5 font-mono">{s.table}</p>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "config", label: "System Config", icon: Settings },
  { id: "audit", label: "Audit Logs", icon: Activity },
  { id: "sessions", label: "Sessions", icon: Users },
  { id: "blacklist", label: "Blacklist", icon: Key },
  { id: "push", label: "Push Test", icon: Send },
  { id: "db", label: "DB Stats", icon: Database },
];

export default function ControlPage() {
  const [activeSection, setActiveSection] = useState<Section>("config");

  return (
    <div className="min-h-screen bg-base-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-error" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-base-content">Super Admin Control</h1>
          <p className="text-sm text-base-content/40">Restricted access — SUPER_ADMIN only</p>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-base-200 rounded-xl">
        {SECTIONS.map((s) => (
          <SectionTab
            key={s.id}
            id={s.id}
            label={s.label}
            icon={s.icon}
            active={activeSection === s.id}
            onClick={() => setActiveSection(s.id)}
          />
        ))}
      </div>

      {/* Content */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body p-5">
          <h2 className="text-lg font-semibold text-base-content mb-4">
            {SECTIONS.find((s) => s.id === activeSection)?.label}
          </h2>
          {activeSection === "config" && <SystemConfigSection />}
          {activeSection === "audit" && <AuditLogsSection />}
          {activeSection === "sessions" && <SessionsSection />}
          {activeSection === "blacklist" && <BlacklistSection />}
          {activeSection === "push" && <PushTestSection />}
          {activeSection === "db" && <DbStatsSection />}
        </div>
      </div>
    </div>
  );
}

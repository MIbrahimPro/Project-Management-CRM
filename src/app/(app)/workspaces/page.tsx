"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Instagram, Layers, Linkedin, Plus, Settings, Twitter, X, Youtube } from "lucide-react";
import toast from "react-hot-toast";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type Workspace = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  createdAt: string;
  _count: { tasks: number; members: number };
  members: { user: { id: string; name: string; profilePicUrl: string | null } }[];
};

type CurrentUser = { id: string; role: string };

const TYPE_ICONS: Record<string, React.ElementType> = {
  INSTAGRAM: Instagram,
  LINKEDIN: Linkedin,
  TWITTER: Twitter,
  YOUTUBE: Youtube,
  GENERAL: Layers,
  CUSTOM: Settings,
};

const TYPE_COLORS: Record<string, string> = {
  INSTAGRAM: "text-pink-500",
  LINKEDIN: "text-blue-600",
  TWITTER: "text-sky-500",
  YOUTUBE: "text-red-500",
  GENERAL: "text-primary",
  CUSTOM: "text-secondary",
};

const WORKSPACE_TYPES = ["GENERAL", "INSTAGRAM", "LINKEDIN", "TWITTER", "YOUTUBE", "CUSTOM"] as const;
const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"];

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("GENERAL");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/workspaces").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ])
      .then(([wsRes, userRes]: [{ data: Workspace[] }, { data: CurrentUser }]) => {
        setWorkspaces(wsRes.data ?? []);
        setUser(userRes.data);
      })
      .catch(() => toast.error("Failed to load social media boards", { style: TOAST_ERROR_STYLE }))
      .finally(() => setLoading(false));
  }, []);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type, description: description.trim() || undefined }),
      });
      const data = (await res.json()) as { data?: Workspace; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Social media section created", { style: TOAST_STYLE });
      setShowModal(false);
      setName(""); setType("GENERAL"); setDescription("");
      router.push(`/workspaces/${data.data!.id}`);
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

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-base-content">Social Media</h1>
            <p className="text-sm text-base-content/50 mt-0.5">Each section is a social media workspace for posts and media</p>
          </div>
          {user && MANAGER_ROLES.includes(user.role) && (
            <button className="btn btn-primary btn-sm gap-2" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4" />
              New social media section
            </button>
          )}
        </div>

        {workspaces.length === 0 ? (
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body items-center py-16 text-base-content/40 gap-3">
              <Layers className="w-12 h-12 opacity-20" />
              <p>No sections yet. Create one to get started.</p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                New social media section
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => {
              const Icon = TYPE_ICONS[ws.type] ?? Layers;
              const color = TYPE_COLORS[ws.type] ?? "text-primary";
              return (
                <button
                  key={ws.id}
                  className="card bg-base-200 hover:bg-base-300 transition-colors shadow-sm text-left"
                  onClick={() => router.push(`/workspaces/${ws.id}`)}
                >
                  <div className="card-body p-5 gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <Icon className={`w-6 h-6 ${color} flex-shrink-0 mt-0.5`} />
                      <ChevronRight className="w-4 h-4 text-base-content/20 flex-shrink-0" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base-content">{ws.name}</h3>
                      {ws.description && (
                        <p className="text-xs text-base-content/50 mt-0.5 line-clamp-2">{ws.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-base-content/40">
                      <span>{ws._count.tasks} post{ws._count.tasks !== 1 ? "s" : ""}</span>
                      <div className="flex -space-x-1.5">
                        {ws.members.slice(0, 4).map((m) => (
                          <div
                            key={m.user.id}
                            className="w-5 h-5 rounded-full bg-primary/30 border border-base-200 flex items-center justify-center text-xs font-bold text-primary"
                            title={m.user.name}
                          >
                            {m.user.name[0]}
                          </div>
                        ))}
                        {ws._count.members > 4 && (
                          <div className="w-5 h-5 rounded-full bg-base-300 border border-base-200 flex items-center justify-center text-xs">
                            +{ws._count.members - 4}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      <dialog className={`modal ${showModal ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">New social media section</h3>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowModal(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text">Name</span></label>
              <input
                type="text"
                className="input input-bordered bg-base-100"
                placeholder="e.g. Social Media Q1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void create()}
              />
            </div>
            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text">Type</span></label>
              <select
                className="select select-bordered bg-base-100"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {WORKSPACE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text">Description (optional)</span></label>
              <textarea
                className="textarea textarea-bordered bg-base-100"
                placeholder="What is this board for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => void create()}
              disabled={creating || !name.trim()}
            >
              {creating && <span className="loading loading-spinner loading-sm" />}
              Create
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setShowModal(false)} />
      </dialog>
    </>
  );
}

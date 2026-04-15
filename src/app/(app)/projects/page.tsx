"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Inbox, Plus, Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import { ProjectCard, type ProjectCardModel } from "@/components/projects/ProjectCard";

type SettingsUser = {
  id: string;
  role: string;
  currencyPreference: string;
};

type ClientRequest = {
  id: string;
  title: string;
  description: string;
  pdfUrl: string | null;
  status: string;
  createdAt: string;
  client: { id: string; name: string; profilePicUrl: string | null } | null;
};

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

export default function ProjectsPage() {
  const router = useRouter();

  const [user, setUser] = useState<SettingsUser | null>(null);
  const [projects, setProjects] = useState<ProjectCardModel[]>([]);
  const [clientRequests, setClientRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [newRequestModalOpen, setNewRequestModalOpen] = useState(false);

  // New project request form (client only)
  const [reqTitle, setReqTitle] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [reqPdf, setReqPdf] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load user + projects in parallel
  useEffect(() => {
    Promise.all([
      fetch("/api/users/me").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ])
      .then(([userRes, projRes]: [{ data: SettingsUser }, { data: ProjectCardModel[] }]) => {
        setUser(userRes.data);
        setProjects(projRes.data ?? []);
      })
      .catch(() => {
        toast.error("Failed to load projects", { style: TOAST_ERROR_STYLE });
      })
      .finally(() => setLoading(false));
  }, []);

  // Load client requests once we know the user's role
  useEffect(() => {
    if (!user) return;
    if (!["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(user.role)) return;
    fetch("/api/projects/client-requests")
      .then((r) => r.json())
      .then((d: { data: ClientRequest[] }) => setClientRequests(d.data ?? []))
      .catch(() => {});
  }, [user]);

  async function ignoreRequest(id: string) {
    await fetch(`/api/projects/client-requests/${id}/ignore`, { method: "PATCH" });
    setClientRequests((prev) => prev.filter((r) => r.id !== id));
    toast.success("Request dismissed", { style: TOAST_STYLE });
  }

  async function submitProjectRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", reqTitle);
      formData.append("description", reqDesc);
      if (reqPdf) formData.append("pdf", reqPdf);

      const res = await fetch("/api/projects/requests", { method: "POST", body: formData });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");

      toast.success("Project request submitted!", { style: TOAST_STYLE });
      setNewRequestModalOpen(false);
      setReqTitle("");
      setReqDesc("");
      setReqPdf(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const isManagerOrAdmin =
    user && ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(user.role);
  const isClient = user?.role === "CLIENT";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold text-base-content">
          {isClient ? "My Projects" : "Projects"}
        </h1>
        <div className="flex items-center gap-2">
          {isManagerOrAdmin && clientRequests.length > 0 && (
            <button
              className="btn btn-outline btn-sm gap-2"
              onClick={() => setRequestsModalOpen(true)}
            >
              <Inbox className="w-4 h-4" />
              Client Requests
              <span className="badge badge-primary badge-sm">{clientRequests.length}</span>
            </button>
          )}
          {isManagerOrAdmin && (
            <button
              className="btn btn-primary btn-sm gap-2"
              onClick={() => router.push("/projects/new")}
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          )}
          {isClient && (
            <button
              className="btn btn-primary btn-sm gap-2"
              onClick={() => setNewRequestModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Request Project
            </button>
          )}
        </div>
      </div>

      {/* Projects grid */}
      {projects.length === 0 ? (
        <div className="text-center py-16 text-base-content/40">
          <div className="text-5xl mb-3">📁</div>
          <p className="text-lg">No projects yet</p>
          {isManagerOrAdmin && (
            <button
              className="btn btn-primary btn-sm mt-4"
              onClick={() => router.push("/projects/new")}
            >
              Create your first project
            </button>
          )}
          {isClient && (
            <button
              className="btn btn-primary btn-sm mt-4"
              onClick={() => setNewRequestModalOpen(true)}
            >
              Request a project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      {/* ── Client requests modal (manager/admin) ── */}
      <dialog className={`modal ${requestsModalOpen ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">Client Project Requests</h3>
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setRequestsModalOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {clientRequests.length === 0 ? (
            <p className="text-center py-8 text-base-content/50">No pending requests</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {clientRequests.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-lg bg-base-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => {
                        setRequestsModalOpen(false);
                        router.push(`/projects/new?requestId=${r.id}`);
                      }}
                    >
                      <p className="font-medium text-base-content text-sm">{r.title}</p>
                      {r.client && (
                        <p className="text-xs text-base-content/50 mt-0.5">{r.client.name}</p>
                      )}
                      <p className="text-xs text-base-content/60 mt-1 line-clamp-2">
                        {r.description}
                      </p>
                    </div>
                    <button
                      className="btn btn-ghost btn-xs text-error flex-shrink-0"
                      onClick={() => void ignoreRequest(r.id)}
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-backdrop" onClick={() => setRequestsModalOpen(false)} />
      </dialog>

      {/* ── New project request modal (client) ── */}
      <dialog className={`modal ${newRequestModalOpen ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">Request a New Project</h3>
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setNewRequestModalOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={(e) => void submitProjectRequest(e)} className="space-y-4">
            <div className="form-control gap-1">
              <label className="label py-0">
                <span className="label-text">Project Title</span>
              </label>
              <input
                type="text"
                className="input input-bordered bg-base-100"
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                placeholder="Brief project title"
                required
                minLength={3}
                maxLength={200}
              />
            </div>

            <div className="form-control gap-1">
              <label className="label py-0">
                <span className="label-text">Description</span>
              </label>
              <textarea
                className="textarea textarea-bordered bg-base-100 min-h-24"
                value={reqDesc}
                onChange={(e) => setReqDesc(e.target.value)}
                placeholder="Describe what you need..."
                required
                minLength={10}
              />
            </div>

            <div className="form-control gap-1">
              <label className="label py-0">
                <span className="label-text">
                  Attach PDF{" "}
                  <span className="text-base-content/40">(optional, max 5MB)</span>
                </span>
              </label>
              {reqPdf ? (
                <div className="flex items-center gap-2 p-2 bg-base-300 rounded-lg">
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm flex-1 truncate">{reqPdf.name}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle text-error"
                    onClick={() => setReqPdf(null)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-base-content/20 rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 transition-colors">
                  <Upload className="w-6 h-6 text-base-content/30 mx-auto mb-1" />
                  <span className="text-sm text-base-content/50">Click to attach PDF</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => setReqPdf(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>

            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setNewRequestModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting && <span className="loading loading-spinner loading-sm" />}
                Submit Request
              </button>
            </div>
          </form>
        </div>
        <div className="modal-backdrop" onClick={() => setNewRequestModalOpen(false)} />
      </dialog>
    </div>
  );
}

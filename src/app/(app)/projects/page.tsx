"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileText, Inbox, Plus, Upload, X, Archive, FolderOpen, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { ProjectCard, type ProjectCardModel } from "@/components/projects/ProjectCard";
import { ProjectRequestCard } from "@/components/projects/ProjectRequestCard";
import { useSocket } from "@/hooks/useSocket";
import ReactMarkdown from "react-markdown";
import type { ProjectStatus } from "@prisma/client";

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
  client?: { id: string; name: string; profilePicUrl: string | null } | null;
};

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

const CURRENT_STATUSES: ProjectStatus[] = ["PENDING", "ACTIVE", "ON_HOLD"];
const PAST_STATUSES: ProjectStatus[] = ["COMPLETED", "CANCELLED"];

export default function ProjectsPage() {
  const router = useRouter();
  const { socket: projectsSocket } = useSocket("/projects");

  const [user, setUser] = useState<SettingsUser | null>(null);
  const [projects, setProjects] = useState<ProjectCardModel[]>([]);
  const [myRequests, setMyRequests] = useState<ClientRequest[]>([]);
  const [clientRequests, setClientRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [newRequestModalOpen, setNewRequestModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [viewFileType, setViewFileType] = useState<"pdf" | "md" | "txt" | "docx">("pdf");
  const [viewTextContent, setViewTextContent] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // New project request form (client only)
  const [reqTitle, setReqTitle] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [reqPdf, setReqPdf] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isManagerOrAdmin = user && ["ADMIN", "PROJECT_MANAGER"].includes(user.role);
  const isClient = user?.role === "CLIENT";

  // Load user + projects + requests in parallel
  useEffect(() => {
    const endpoints: [string, string] = ["/api/users/me", "/api/projects"];
    const requests: Promise<any>[] = [
      fetch("/api/users/me").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ];

    Promise.all(requests)
      .then(([userRes, projRes]) => {
        const userData = (userRes as { data: SettingsUser }).data;
        setUser(userData);
        setProjects((projRes as { data: ProjectCardModel[] }).data ?? []);

        // Load client-specific data
        if (userData?.role === "CLIENT") {
          fetch("/api/projects/my-requests")
            .then((r) => r.json())
            .then((d: { data: ClientRequest[] }) => setMyRequests(d.data ?? []))
            .catch(() => {});
        }
      })
      .catch(() => {
        toast.error("Failed to load projects", { style: TOAST_ERROR_STYLE });
      })
      .finally(() => setLoading(false));
  }, []);

  // Load manager client requests once we know the user's role
  useEffect(() => {
    if (!user || !isManagerOrAdmin) return;
    fetch("/api/projects/client-requests")
      .then((r) => r.json())
      .then((d: { data: ClientRequest[] }) => setClientRequests(d.data ?? []))
      .catch(() => {});
  }, [user, isManagerOrAdmin]);

  // Real-time project updates
  useEffect(() => {
    if (!projectsSocket) return;

    const handleProjectCreated = (data: { project: ProjectCardModel }) => {
      setProjects((prev) => {
        const exists = prev.find((p) => p.id === data.project.id);
        if (exists) return prev;
        return [data.project, ...prev];
      });
    };

    const handleProjectUpdate = (data: { project: ProjectCardModel }) => {
      setProjects((prev) => {
        const exists = prev.find((p) => p.id === data.project.id);
        if (exists) {
          return prev.map((p) => (p.id === data.project.id ? data.project : p));
        }
        return [...prev, data.project];
      });
    };

    const handleRequestUpdate = (data: { request: ClientRequest }) => {
      if (isClient) {
        // If request is accepted, remove it from client requests (they'll see the project instead)
        if (data.request.status === "ACCEPTED") {
          setMyRequests((prev) => prev.filter((r) => r.id !== data.request.id));
        } else {
          setMyRequests((prev) =>
            prev.map((r) => (r.id === data.request.id ? data.request : r))
          );
        }
      }
      if (isManagerOrAdmin) {
        setClientRequests((prev) =>
          prev.map((r) => (r.id === data.request.id ? data.request : r))
        );
      }
    };

    const handleRequestDelete = (data: { requestId: string }) => {
      if (isManagerOrAdmin) {
        setClientRequests((prev) => prev.filter((r) => r.id !== data.requestId));
      }
    };

    projectsSocket.on("project_created", handleProjectCreated);
    projectsSocket.on("project_updated", handleProjectUpdate);
    projectsSocket.on("request_updated", handleRequestUpdate);
    projectsSocket.on("request_deleted", handleRequestDelete);

    return () => {
      projectsSocket.off("project_created", handleProjectCreated);
      projectsSocket.off("project_updated", handleProjectUpdate);
      projectsSocket.off("request_updated", handleRequestUpdate);
      projectsSocket.off("request_deleted", handleRequestDelete);
    };
  }, [projectsSocket, isClient, isManagerOrAdmin]);

  async function ignoreRequest(id: string) {
    await fetch(`/api/projects/client-requests/${id}/ignore`, { method: "PATCH" });
    setClientRequests((prev) => prev.filter((r) => r.id !== id));
    toast.success("Request dismissed", { style: TOAST_STYLE });
  }

  async function viewFile(requestId: string) {
    setPdfLoading(true);
    setPdfModalOpen(true);
    try {
      const res = await fetch(`/api/projects/requests/${requestId}/pdf`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load file");
      const { url, fileType, textContent } = data.data;
      setPdfUrl(url);
      setViewFileType(fileType);
      setViewTextContent(textContent);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load file", { style: TOAST_ERROR_STYLE });
      setPdfModalOpen(false);
    } finally {
      setPdfLoading(false);
    }
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
      
      // Refresh my requests
      const r = await fetch("/api/projects/my-requests");
      const d = await r.json();
      setMyRequests(d.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setSubmitting(false);
    }
  }

  // Group projects by status
  const { currentProjects, pastProjects } = useMemo(() => {
    const current = projects.filter((p) => CURRENT_STATUSES.includes(p.status));
    const past = projects.filter((p) => PAST_STATUSES.includes(p.status));
    return { currentProjects: current, pastProjects: past };
  }, [projects]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const ProjectSection = ({ title, icon: Icon, projects: sectionProjects, emptyText }: { 
    title: string; 
    icon: any; 
    projects: ProjectCardModel[]; 
    emptyText?: string;
  }) => {
    if (sectionProjects.length === 0 && !emptyText) return null;
    
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-base-300 pb-2">
          <Icon className="w-5 h-5 text-base-content/60" />
          <h2 className="text-lg font-semibold text-base-content">{title}</h2>
          <span className="badge badge-sm badge-ghost">{sectionProjects.length}</span>
        </div>
        {sectionProjects.length === 0 ? (
          emptyText && <p className="text-sm text-base-content/40 py-4">{emptyText}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sectionProjects.map((p) => (
              <div key={p.id} className="relative group">
                <ProjectCard project={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
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

      {/* Client Requests Section */}
      {isClient && myRequests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-warning/30 pb-2">
            <Clock className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold text-base-content">My Requests</h2>
            <span className="badge badge-sm badge-warning">{myRequests.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {myRequests.map((r) => (
              <ProjectRequestCard
                key={r.id}
                request={r}
                onUpdate={(updated) =>
                  setMyRequests((prev) =>
                    prev.map((req) => (req.id === updated.id ? updated : req))
                  )
                }
                onDelete={(id) => setMyRequests((prev) => prev.filter((req) => req.id !== id))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && (!isClient || myRequests.length === 0) ? (
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
        <>
          {/* Current Projects */}
          <ProjectSection
            title="Current Projects"
            icon={FolderOpen}
            projects={currentProjects}
            emptyText="No active projects"
          />

          {/* Past Projects */}
          {pastProjects.length > 0 && (
            <ProjectSection
              title="Past Projects"
              icon={Archive}
              projects={pastProjects}
            />
          )}
        </>
      )}

      {/* ── Client requests modal (manager/admin) ── */}
      <dialog className={`modal ${requestsModalOpen ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-2xl max-h-[85vh]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg text-base-content">Client Project Requests</h3>
              <p className="text-sm text-base-content/50">
                {clientRequests.length} pending request{clientRequests.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setRequestsModalOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {clientRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-base-content/40">
              <Inbox className="w-12 h-12 mb-3" />
              <p>No pending requests</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {clientRequests.map((r) => (
                <div
                  key={r.id}
                  className="card bg-base-100 border border-base-300 shadow-sm"
                >
                  <div className="card-body p-4 gap-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-base-content text-sm">{r.title}</h4>
                        {r.client && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="badge badge-sm badge-ghost">{r.client.name}</span>
                          </div>
                        )}
                      </div>
                      <span className="badge badge-sm badge-warning">Pending</span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-base-content/70 line-clamp-3">
                      {r.description}
                    </p>

                    {/* File & Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-base-200">
                      <div>
                        {r.pdfUrl && (
                          <button
                            onClick={() => void viewFile(r.id)}
                            className="btn btn-ghost btn-sm gap-1.5 text-primary"
                          >
                            <FileText className="w-4 h-4" />
                            View Brief
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="btn btn-ghost btn-sm text-error"
                          onClick={() => void ignoreRequest(r.id)}
                        >
                          Ignore
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setRequestsModalOpen(false);
                            router.push(`/projects/new?requestId=${r.id}`);
                          }}
                        >
                          Create Project
                        </button>
                      </div>
                    </div>
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
                  Attach Brief{" "}
                  <span className="text-base-content/40">(optional, PDF/DOCX/MD/TXT, max 5MB)</span>
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
                  <span className="text-sm text-base-content/50">Click to attach file</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.md,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
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

      {/* ── PDF Viewer Modal ── */}
      <dialog className={`modal ${pdfModalOpen ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-5xl w-full h-[85vh] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">File Viewer</h3>
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => {
                setPdfModalOpen(false);
                setPdfUrl(null);
                setViewTextContent(null);
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 bg-base-300 rounded-lg overflow-hidden">
            {pdfLoading ? (
              <div className="flex items-center justify-center h-full">
                <span className="loading loading-spinner loading-lg text-primary" />
              </div>
            ) : viewFileType === "pdf" && pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title="File Viewer"
              />
            ) : viewTextContent ? (
              <div className="p-6 overflow-y-auto h-full">
                {viewFileType === "md" ? (
                  <div className="prose prose-sm max-w-none text-base-content">
                    <ReactMarkdown>{viewTextContent}</ReactMarkdown>
                  </div>
                ) : (
                  <pre className="text-sm text-base-content whitespace-pre-wrap font-mono leading-relaxed">
                    {viewTextContent}
                  </pre>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-base-content/50">
                Failed to load file
              </div>
            )}
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => { setPdfModalOpen(false); setPdfUrl(null); setViewTextContent(null); }} />
      </dialog>
    </div>
  );
}

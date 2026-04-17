"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Check, ChevronDown, ClipboardCopy, Download, FileText, Pencil, Printer, Trash2, Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import { DocTree, type DocItem } from "@/components/documents/DocTree";
import { ResizablePanel } from "@/components/ui/ResizablePanel";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

// Dynamic import — BlockNote/Hocuspocus are browser-only
const DocumentEditor = dynamic(() => import("@/components/documents/DocumentEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <span className="loading loading-spinner loading-md text-primary" />
    </div>
  ),
});

type Milestone = { id: string; order: number; title: string };
type CurrentUser = { id: string; name: string; role: string };

const ACCESS_LABELS: Record<string, string> = {
  PRIVATE: "Private",
  INTERNAL: "Internal",
  CLIENT_VIEW: "Client (view)",
  CLIENT_EDIT: "Client (edit)",
};

const ACCESS_BADGE: Record<string, string> = {
  PRIVATE: "badge-warning",
  INTERNAL: "badge-neutral",
  CLIENT_VIEW: "badge-info",
  CLIENT_EDIT: "badge-success",
};

export default function DocumentsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";

  const [docs, setDocs] = useState<DocItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [collabToken, setCollabToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  // New doc modal
  const [newDocModal, setNewDocModal] = useState<{ milestoneId?: string; docType: string } | null>(null);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocAccess, setNewDocAccess] = useState<"PRIVATE" | "INTERNAL" | "CLIENT_VIEW" | "CLIENT_EDIT">("INTERNAL");
  const [creatingDoc, setCreatingDoc] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/documents`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch("/api/users/me").then((r) => r.json()),
      fetch("/api/auth/collab-token").then((r) => r.json()),
    ])
      .then(
        ([docsRes, projRes, userRes, tokenRes]: [
          { data: DocItem[] },
          { data: { milestones: Milestone[] } },
          { data: CurrentUser },
          { token?: string },
        ]) => {
          const docList = docsRes.data ?? [];
          setDocs(docList);
          setMilestones(projRes.data?.milestones ?? []);
          setUser(userRes.data);
          if (tokenRes.token) setCollabToken(tokenRes.token);

          // Auto-select requirements doc
          const reqDoc = docList.find((d) => d.docType === "requirements");
          if (reqDoc) setSelectedDoc(reqDoc);
        }
      )
      .catch(() => toast.error("Failed to load documents", { style: TOAST_ERROR_STYLE }))
      .finally(() => setLoading(false));
  }, [projectId]);

  const isManager = user
    ? ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(user.role)
    : false;
  const isClient = user?.role === "CLIENT";

  // ── Title edit ─────────────────────────────────────────────────────────────
  function startEditTitle() {
    if (!selectedDoc || selectedDoc.docType === "requirements") return;
    setTitleDraft(selectedDoc.title);
    setEditingTitle(true);
  }

  async function saveTitle() {
    if (!selectedDoc || !titleDraft.trim()) return;
    setSavingTitle(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/documents/${selectedDoc.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: titleDraft.trim() }),
        }
      );
      if (!res.ok) throw new Error("Failed to save");
      const updated = { ...selectedDoc, title: titleDraft.trim() };
      setDocs((prev) => prev.map((d) => (d.id === selectedDoc.id ? updated : d)));
      setSelectedDoc(updated);
      setEditingTitle(false);
      toast.success("Title saved", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to save title", { style: TOAST_ERROR_STYLE });
    } finally {
      setSavingTitle(false);
    }
  }

  // ── Access change ──────────────────────────────────────────────────────────
  async function changeAccess(access: DocItem["access"]) {
    if (!selectedDoc || !isManager) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/documents/${selectedDoc.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access }),
        }
      );
      if (!res.ok) throw new Error();
      const updated = { ...selectedDoc, access };
      setDocs((prev) => prev.map((d) => (d.id === selectedDoc.id ? updated : d)));
      setSelectedDoc(updated);
      toast.success("Access updated", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to update access", { style: TOAST_ERROR_STYLE });
    }
  }
  
  // ── Public sharing ──────────────────────────────────────────────────────────
  async function togglePublicSharing(action: "enable" | "disable" | "regenerate") {
    if (!selectedDoc || !isManager) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/documents/${selectedDoc.id}/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      const updated = { ...selectedDoc, isShared: data.isShared, shareToken: data.shareToken };
      setDocs((prev) => prev.map((d) => (d.id === selectedDoc.id ? updated : d)));
      setSelectedDoc(updated);
      toast.success(action === "disable" ? "Public link disabled" : "Public link active", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to update sharing", { style: TOAST_ERROR_STYLE });
    }
  }

  // ── Delete doc ─────────────────────────────────────────────────────────────
  async function deleteDoc() {
    if (!selectedDoc || !isManager) return;
    if (!confirm(`Delete "${selectedDoc.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/documents/${selectedDoc.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      setDocs((prev) => prev.filter((d) => d.id !== selectedDoc.id));
      setSelectedDoc(null);
      toast.success("Document deleted", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    }
  }

  // ── Create doc ─────────────────────────────────────────────────────────────
  async function createDoc() {
    if (!newDocModal || !newDocTitle.trim()) return;
    setCreatingDoc(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newDocTitle.trim(),
          docType: newDocModal.docType,
          access: newDocAccess,
          milestoneId: newDocModal.milestoneId ?? null,
        }),
      });
      const data = (await res.json()) as { data?: DocItem; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setDocs((prev) => [...prev, data.data!]);
      setSelectedDoc(data.data!);
      setNewDocModal(null);
      setNewDocTitle("");
      setNewDocAccess("INTERNAL");
      toast.success("Document created", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setCreatingDoc(false);
    }
  }

  // ── Export / Import ────────────────────────────────────────────────────────
  function printDoc() {
    window.print();
  }

  async function copyToClipboard() {
    try {
      const editorEl = document.querySelector(".bn-editor");
      if (!editorEl) return;
      const html = editorEl.innerHTML;
      const text = editorEl.textContent ?? "";
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      toast.success("Copied to clipboard", { style: TOAST_STYLE });
    } catch {
      toast.error("Copy failed", { style: TOAST_ERROR_STYLE });
    }
  }

  function downloadMarkdown() {
    const editorEl = document.querySelector(".bn-editor");
    if (!editorEl) return;
    const text = editorEl.textContent ?? "";
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedDoc?.title ?? "document"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const canEdit =
    selectedDoc &&
    (!isClient || selectedDoc.access === "CLIENT_EDIT");

  return (
    <>
      <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-base-300">
        {/* ── DocTree sidebar ── */}
        <ResizablePanel
          defaultWidth={240}
          minWidth={180}
          maxWidth={480}
          storageKey="doctree-sidebar-width"
          className="border-r border-base-300 bg-base-200"
        >
          <DocTree
            docs={docs}
            milestones={milestones}
            selectedId={selectedDoc?.id ?? null}
            currentUserId={user?.id ?? ""}
            currentUserRole={user?.role ?? ""}
            onSelect={setSelectedDoc}
            onNewDoc={(opts) => {
              setNewDocModal(opts);
              setNewDocTitle("");
              setNewDocAccess("INTERNAL");
            }}
          />
        </ResizablePanel>

        {/* ── Editor area ── */}
        {selectedDoc ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Doc header */}
            <div className="flex items-center gap-3 px-4 py-2 bg-base-200 border-b border-base-300 flex-shrink-0 flex-wrap">
              {/* Title */}
              {editingTitle ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="text"
                    className="input input-sm input-bordered bg-base-100 flex-1"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveTitle();
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                    autoFocus
                  />
                  <button
                    className="btn btn-ghost btn-xs btn-circle"
                    onClick={() => void saveTitle()}
                    disabled={savingTitle}
                  >
                    {savingTitle ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-success" />
                    )}
                  </button>
                  <button
                    className="btn btn-ghost btn-xs btn-circle"
                    onClick={() => setEditingTitle(false)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="w-4 h-4 text-base-content/40 flex-shrink-0" />
                  <h2 className="font-semibold text-base-content text-sm truncate flex-1">
                    {selectedDoc.title}
                  </h2>
                  {!isClient && selectedDoc.docType !== "requirements" && (
                    <button
                      className="btn btn-ghost btn-xs btn-circle flex-shrink-0"
                      onClick={startEditTitle}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Access badge */}
                <span className={`badge badge-sm ${ACCESS_BADGE[selectedDoc.access]}`}>
                  {ACCESS_LABELS[selectedDoc.access]}
                </span>

                {/* Share/access dropdown — managers only */}
                {isManager && (
                  <div className="dropdown dropdown-end">
                    <label tabIndex={0} className="btn btn-ghost btn-xs gap-1">
                      Share <ChevronDown className="w-3 h-3" />
                    </label>
                    <ul
                      tabIndex={0}
                      className="dropdown-content menu bg-base-200 border border-base-300 rounded-box w-44 shadow-lg z-50"
                    >
                      {(
                        ["INTERNAL", "CLIENT_VIEW", "CLIENT_EDIT", "PRIVATE"] as const
                      ).map((a) => (
                        <li key={a}>
                          <button
                            className={selectedDoc.access === a ? "active" : ""}
                            onClick={() => void changeAccess(a)}
                          >
                            {ACCESS_LABELS[a]}
                          </button>
                        </li>
                      ))}
                      {/* Public sharing section */}
                      <li className="menu-title mt-2 border-t border-base-300 pt-2">Public Link</li>
                      <li>
                        <div className="flex flex-col gap-2 p-2">
                          <label className="label cursor-pointer p-0 gap-2">
                            <span className="text-xs">Enabled</span>
                            <input
                              type="checkbox"
                              className="toggle toggle-primary toggle-xs"
                              checked={!!selectedDoc.isShared}
                              onChange={(e) => void togglePublicSharing(e.target.checked ? "enable" : "disable")}
                            />
                          </label>
                          
                          {selectedDoc.isShared && selectedDoc.shareToken && (
                            <div className="flex flex-col gap-1 w-full mt-1">
                              <div className="flex items-center gap-1 w-full">
                                <input
                                  type="text"
                                  readOnly
                                  className="input input-xs bg-base-300 flex-1 truncate text-[10px]"
                                  value={`${window.location.origin}/docs/${selectedDoc.shareToken}`}
                                />
                                <button
                                  className="btn btn-ghost btn-xs btn-square"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/docs/${selectedDoc.shareToken}`);
                                    toast.success("Link copied", { style: TOAST_STYLE });
                                  }}
                                >
                                  <ClipboardCopy className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </li>
                    </ul>
                  </div>
                )}

                {/* Export buttons */}
                <div className="dropdown dropdown-end">
                  <label tabIndex={0} className="btn btn-ghost btn-xs gap-1">
                    <Download className="w-3 h-3" /> Export
                  </label>
                  <ul tabIndex={0} className="dropdown-content menu bg-base-200 border border-base-300 rounded-box w-40 shadow-lg z-50">
                    <li><button onClick={printDoc}><Printer className="w-3.5 h-3.5" /> Print / PDF</button></li>
                    <li><button onClick={downloadMarkdown}><Download className="w-3.5 h-3.5" /> Markdown</button></li>
                    <li><button onClick={() => void copyToClipboard()}><ClipboardCopy className="w-3.5 h-3.5" /> Copy</button></li>
                  </ul>
                </div>

                {/* Delete — managers only, non-system docs */}
                {isManager && selectedDoc.docType !== "requirements" && (
                  <button
                    className="btn btn-ghost btn-xs btn-circle text-error"
                    title="Delete document"
                    onClick={() => void deleteDoc()}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* BlockNote editor */}
            <div className="flex-1 overflow-y-auto bg-base-100">
              {collabToken ? (
                <DocumentEditor
                  key={selectedDoc.id}
                  docId={selectedDoc.id}
                  projectId={projectId}
                  collabToken={collabToken}
                  currentUser={{ id: user?.id ?? "", name: user?.name ?? "User" }}
                  readOnly={!canEdit}
                  initialContent={selectedDoc.initialContent}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="loading loading-spinner loading-md text-primary" />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-base-content/40 gap-3">
            <FileText className="w-12 h-12 opacity-20" />
            <p className="text-sm">Select a document to view or edit</p>
            {!isClient && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setNewDocModal({ docType: "custom" });
                  setNewDocTitle("");
                  setNewDocAccess("INTERNAL");
                }}
              >
                Create Document
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── New doc modal ── */}
      <dialog className={`modal ${newDocModal ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">New Document</h3>
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setNewDocModal(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="form-control gap-1">
              <label className="label py-0">
                <span className="label-text">Title</span>
              </label>
              <input
                type="text"
                className="input input-bordered bg-base-100"
                placeholder="Document title"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void createDoc()}
              />
            </div>
            <div className="form-control gap-1">
              <label className="label py-0">
                <span className="label-text">Access</span>
              </label>
              <select
                className="select select-bordered bg-base-100"
                value={newDocAccess}
                onChange={(e) =>
                  setNewDocAccess(
                    e.target.value as "PRIVATE" | "INTERNAL" | "CLIENT_VIEW" | "CLIENT_EDIT"
                  )
                }
              >
                <option value="INTERNAL">Internal (team only)</option>
                <option value="CLIENT_VIEW">Client (view only)</option>
                <option value="CLIENT_EDIT">Client (can edit)</option>
                <option value="PRIVATE">Private (only me)</option>
              </select>
            </div>
          </div>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setNewDocModal(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void createDoc()}
              disabled={creatingDoc || !newDocTitle.trim()}
            >
              {creatingDoc && <span className="loading loading-spinner loading-sm" />}
              Create
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setNewDocModal(null)} />
      </dialog>
    </>
  );
}

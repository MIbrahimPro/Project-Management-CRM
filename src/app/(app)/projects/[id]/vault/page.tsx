"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Copy, Eye, EyeOff, KeyRound, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type Secret = {
  id: string;
  key: string;
  value: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function ProjectVaultPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";

  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  // New secret modal
  const [modalOpen, setModalOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    void load();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/vault`);
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as { data: Secret[] };
      setSecrets(json.data ?? []);
    } catch {
      toast.error("Failed to load vault", { style: TOAST_ERROR_STYLE });
    } finally {
      setLoading(false);
    }
  }

  async function saveSecret() {
    if (!newKey.trim() || !newValue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/vault`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newKey.trim(),
          value: newValue,
          description: newDesc.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Secret saved", { style: TOAST_STYLE });
      setModalOpen(false);
      setNewKey("");
      setNewValue("");
      setNewDesc("");
      void load();
    } catch {
      toast.error("Failed to save", { style: TOAST_ERROR_STYLE });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSecret(secretId: string) {
    if (!confirm("Delete this secret?")) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/vault/${secretId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setSecrets((prev) => prev.filter((s) => s.id !== secretId));
      toast.success("Deleted", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to delete", { style: TOAST_ERROR_STYLE });
    }
  }

  function copyValue(value: string) {
    void navigator.clipboard.writeText(value);
    toast.success("Copied", { style: TOAST_STYLE });
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
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-base-content flex items-center gap-2">
              <KeyRound className="w-6 h-6 text-primary" />
              Project Vault
            </h1>
            <p className="text-sm text-base-content/60 mt-1 max-w-2xl">
              Store API keys, environment variables, and other secrets here. Anything you store
              in the vault is kept private to project members and is excluded from the AI assistant.
              <br />
              <span className="text-warning">
                Secrets stored anywhere else (chat, docs, descriptions) may be visible to AI — always use the vault.
              </span>
            </p>
          </div>
          <button className="btn btn-primary btn-sm gap-2" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            New Secret
          </button>
        </div>

        {/* Empty state */}
        {secrets.length === 0 ? (
          <div className="card bg-base-200 border border-base-300 border-dashed">
            <div className="card-body items-center text-center text-base-content/50 py-12">
              <KeyRound className="w-10 h-10 opacity-30" />
              <p className="text-sm">No secrets yet</p>
              <p className="text-xs">Use the vault for env vars, tokens, and credentials.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {secrets.map((s) => {
              const isRevealed = revealed[s.id] ?? false;
              return (
                <div key={s.id} className="card bg-base-200 border border-base-300">
                  <div className="card-body p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-sm font-mono font-semibold text-primary">{s.key}</code>
                          <span className="text-xs text-base-content/40">
                            {new Date(s.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs font-mono px-2 py-1.5 bg-base-100 rounded border border-base-300 text-base-content/80 truncate">
                            {isRevealed ? s.value : "•".repeat(Math.min(40, s.value.length))}
                          </code>
                          <button
                            className="btn btn-ghost btn-xs btn-square"
                            onClick={() => setRevealed((p) => ({ ...p, [s.id]: !isRevealed }))}
                            title={isRevealed ? "Hide" : "Reveal"}
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            className="btn btn-ghost btn-xs btn-square"
                            onClick={() => copyValue(s.value)}
                            title="Copy"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="btn btn-ghost btn-xs btn-square text-error"
                            onClick={() => void deleteSecret(s.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {s.description && (
                          <p className="text-xs text-base-content/50 mt-2">{s.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <dialog className={`modal ${modalOpen ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-base-content">New Secret</h3>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setModalOpen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="form-control gap-1">
              <label className="label py-0">
                <span className="label-text">Key</span>
              </label>
              <input
                type="text"
                className="input input-bordered input-sm bg-base-100 font-mono"
                placeholder="STRIPE_SECRET_KEY"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-control gap-1">
              <label className="label py-0">
                <span className="label-text">Value</span>
              </label>
              <textarea
                className="textarea textarea-bordered bg-base-100 font-mono text-xs"
                placeholder="sk_live_..."
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                rows={3}
              />
            </div>
            <div className="form-control gap-1">
              <label className="label py-0">
                <span className="label-text">Description (optional)</span>
              </label>
              <input
                type="text"
                className="input input-bordered input-sm bg-base-100"
                placeholder="What this is for"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void saveSecret()}
              disabled={saving || !newKey.trim() || !newValue.trim()}
            >
              {saving && <span className="loading loading-spinner loading-sm" />}
              Save
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setModalOpen(false)} />
      </dialog>
    </>
  );
}

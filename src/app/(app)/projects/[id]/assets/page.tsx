"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  FileText,
  Image,
  Film,
  Music,
  FileCode,
  Archive,
  File,
  Upload,
  Download,
  Trash2,
  MoreVertical,
  Eye,
  EyeOff,
  X,
  HardDrive,
  ExternalLink,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useSocket } from "@/hooks/useSocket";

interface Asset {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  fileSizeFormatted: string;
  isVisibleToClient: boolean;
  createdAt: string;
  uploadedBy: {
    id: string;
    name: string;
    role: string;
  };
}

interface User {
  id: string;
  role: string;
}

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return Image;
  if (fileType.startsWith("video/")) return Film;
  if (fileType.startsWith("audio/")) return Music;
  if (fileType.includes("pdf")) return FileText;
  if (fileType.includes("zip") || fileType.includes("rar") || fileType.includes("7z")) return Archive;
  if (fileType.includes("javascript") || fileType.includes("typescript") || fileType.includes("json") || fileType.includes("html") || fileType.includes("css")) return FileCode;
  return File;
}

function formatFileType(fileType: string): string {
  if (!fileType || fileType === "application/octet-stream") return "File";
  return fileType.split("/").pop()?.toUpperCase() || "File";
}

function canPreview(fileType: string): boolean {
  return (
    fileType.startsWith("image/") ||
    fileType === "application/pdf" ||
    fileType.startsWith("video/") ||
    fileType.startsWith("audio/")
  );
}

export default function AssetsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { socket } = useSocket("/chat");

  const [assets, setAssets] = useState<Asset[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadQueue, setUploadQueue] = useState<{ file: File; status: "uploading" | "done" | "error" }[]>([]);

  // Delete confirmation modal
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);

  // Preview modal
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isManager = user && MANAGER_ROLES.includes(user.role);
  const isClient = user?.role === "CLIENT";

  // Load user and assets
  useEffect(() => {
    Promise.all([
      fetch("/api/users/me").then((r) => r.json()),
      fetch(`/api/projects/${projectId}/assets`).then((r) => r.json()),
    ])
      .then(([userRes, assetsRes]) => {
        setUser(userRes.data);
        setAssets(assetsRes.data ?? []);
      })
      .catch(() => {
        toast.error("Failed to load assets", { style: TOAST_ERROR_STYLE });
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  // Socket listeners for live asset updates (server auto-joins project rooms)
  useEffect(() => {
    if (!socket || !projectId || !user) return;

    const isClientUser = user.role === "CLIENT";

    const handleAssetCreated = (data: { asset: Asset }) => {
      if (isClientUser && !data.asset.isVisibleToClient) return;
      setAssets((prev) => {
        if (prev.some((a) => a.id === data.asset.id)) return prev;
        return [data.asset, ...prev];
      });
    };

    const handleAssetUpdated = (data: { asset: Asset }) => {
      if (isClientUser && !data.asset.isVisibleToClient) {
        // Asset was hidden from client — remove it
        setAssets((prev) => prev.filter((a) => a.id !== data.asset.id));
        return;
      }
      setAssets((prev) =>
        prev.map((a) => (a.id === data.asset.id ? data.asset : a))
      );
    };

    const handleAssetDeleted = (data: { assetId: string }) => {
      setAssets((prev) => prev.filter((a) => a.id !== data.assetId));
    };

    socket.on("asset_created", handleAssetCreated);
    socket.on("asset_updated", handleAssetUpdated);
    socket.on("asset_deleted", handleAssetDeleted);

    return () => {
      socket.off("asset_created", handleAssetCreated);
      socket.off("asset_updated", handleAssetUpdated);
      socket.off("asset_deleted", handleAssetDeleted);
    };
  }, [socket, projectId, user?.role]);

  async function uploadSingle(file: File) {
    setUploadQueue((prev) => [...prev, { file, status: "uploading" }]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadData = (await uploadRes.json()) as { data?: { url: string } };

      const assetRes = await fetch(`/api/projects/${projectId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          fileUrl: uploadData.data?.url,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      if (!assetRes.ok) throw new Error("Failed to create asset");
      const assetData = (await assetRes.json()) as { data?: Asset };

      // Immediately add to local state so uploader sees it without waiting for socket
      if (assetData.data) {
        setAssets((prev) => {
          if (prev.some((a) => a.id === assetData.data!.id)) return prev;
          return [assetData.data!, ...prev];
        });
      }

      toast.success(`Uploaded ${file.name}`, { style: TOAST_STYLE });
      setUploadQueue((prev) =>
        prev.map((q) => (q.file === file ? { ...q, status: "done" } : q))
      );
    } catch {
      toast.error(`Failed to upload ${file.name}`, { style: TOAST_ERROR_STYLE });
      setUploadQueue((prev) =>
        prev.map((q) => (q.file === file ? { ...q, status: "error" } : q))
      );
    }
  }

  async function downloadFile(url: string, filename: string) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success(`Downloaded ${filename}`, { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to download file", { style: TOAST_ERROR_STYLE });
    }
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await Promise.all(fileArray.map((f) => uploadSingle(f)));
    // Clean up done items after a delay
    setTimeout(() => {
      setUploadQueue((prev) => prev.filter((q) => q.status !== "done"));
    }, 3000);
  }

  async function toggleVisibility(asset: Asset) {
    const nextStatus = !asset.isVisibleToClient;
    // Optimistic update
    setAssets((prev) =>
      prev.map((a) =>
        a.id === asset.id ? { ...a, isVisibleToClient: nextStatus } : a
      )
    );
    try {
      const res = await fetch(`/api/projects/${projectId}/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVisibleToClient: nextStatus }),
      });

      if (!res.ok) throw new Error("Failed to update");

      toast.success(
        nextStatus ? "Asset now visible to client" : "Asset hidden from client",
        { style: TOAST_STYLE }
      );
    } catch {
      // Rollback on error
      setAssets((prev) =>
        prev.map((a) =>
          a.id === asset.id ? { ...a, isVisibleToClient: asset.isVisibleToClient } : a
        )
      );
      toast.error("Failed to update visibility", { style: TOAST_ERROR_STYLE });
    }
  }

  async function confirmDelete() {
    if (!deletingAsset) return;
    const asset = deletingAsset;
    setDeletingAsset(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/assets/${asset.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      toast.success("Asset deleted", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to delete asset", { style: TOAST_ERROR_STYLE });
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-base-content flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-primary" />
            Assets
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Upload files, media, and documents for the project.
          </p>
        </div>
        <label className="btn btn-primary btn-sm gap-2 cursor-pointer">
          <Upload className="w-4 h-4" />
          Upload Files
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleFilesSelected(e.target.files)}
          />
        </label>
      </div>

      {/* Upload progress */}
      {uploadQueue.length > 0 && (
        <div className="card bg-base-200 border border-primary/30 shadow-sm">
          <div className="card-body p-4">
            <h3 className="font-medium text-sm mb-2">Uploading</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {uploadQueue.map((q, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {q.status === "uploading" ? (
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  ) : q.status === "done" ? (
                    <span className="text-success text-xs">✓</span>
                  ) : (
                    <span className="text-error text-xs">✕</span>
                  )}
                  <span className={q.status === "error" ? "text-error line-through" : "text-base-content/80"}>
                    {q.file.name}
                  </span>
                  <span className="text-xs text-base-content/40 ml-auto">
                    {(q.file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Assets grid */}
      {assets.length === 0 ? (
        <div className="card bg-base-200 border border-base-300 border-dashed">
          <div className="card-body items-center text-center text-base-content/50 py-12">
            <HardDrive className="w-10 h-10 opacity-30" />
            <p className="text-sm">No assets yet</p>
            <p className="text-xs">Upload files to share with the team</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => {
            const Icon = getFileIcon(asset.fileType);
            const isClientUploader = asset.uploadedBy.role === "CLIENT";
            const showVisibilityBadge = !isClient && !isClientUploader;
            const previewable = canPreview(asset.fileType);

            return (
              <div key={asset.id} className="card bg-base-200 border border-base-300 hover:border-primary/40 transition-colors">
                <div className="card-body p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {asset.fileType.startsWith("image/") ? (
                        <div className="w-14 h-14 rounded-lg bg-base-300 overflow-hidden">
                          <img
                            src={asset.fileUrl}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-base-300 flex items-center justify-center">
                          <Icon className="w-7 h-7 text-base-content/60" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-base-content truncate" title={asset.name}>
                        {asset.name}
                      </h3>
                      <p className="text-xs text-base-content/50">
                        {formatFileType(asset.fileType)} • {asset.fileSizeFormatted}
                      </p>
                      <p className="text-xs text-base-content/40 mt-1">
                        by {asset.uploadedBy.name}
                      </p>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {isClientUploader ? (
                          <span className="badge badge-xs badge-success">Client upload</span>
                        ) : showVisibilityBadge ? (
                          asset.isVisibleToClient ? (
                            <span className="badge badge-xs badge-success gap-1">
                              <Eye className="w-3 h-3" />
                              Client visible
                            </span>
                          ) : (
                            <span className="badge badge-xs badge-ghost gap-1">
                              <EyeOff className="w-3 h-3" />
                              Hidden from client
                            </span>
                          )
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-base-300">
                    {previewable ? (
                      <button
                        className="btn btn-ghost btn-xs gap-1 flex-1"
                        onClick={() => setPreviewAsset(asset)}
                      >
                        <Eye className="w-3 h-3" />
                        Preview
                      </button>
                    ) : (
                      <a
                        href={asset.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs gap-1 flex-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open
                      </a>
                    )}
                    <button
                      className="btn btn-ghost btn-xs gap-1 flex-1"
                      onClick={() => void downloadFile(asset.fileUrl, asset.name)}
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>

                    {isManager && (
                      <div className="dropdown dropdown-end">
                        <button tabIndex={0} className="btn btn-ghost btn-xs btn-circle">
                          <MoreVertical className="w-3 h-3" />
                        </button>
                        <ul
                          tabIndex={0}
                          className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
                        >
                          {!isClientUploader && (
                            <li>
                              <button onClick={() => toggleVisibility(asset)}>
                                {asset.isVisibleToClient ? (
                                  <>
                                    <EyeOff className="w-4 h-4" />
                                    Hide from client
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-4 h-4" />
                                    Make visible to client
                                  </>
                                )}
                              </button>
                            </li>
                          )}
                          <li>
                            <button onClick={() => setDeletingAsset(asset)} className="text-error">
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </li>
                        </ul>
                      </div>
                    )}

                    {!isManager && asset.uploadedBy.id === user?.id && (
                      <button
                        className="btn btn-ghost btn-xs btn-circle text-error"
                        onClick={() => setDeletingAsset(asset)}
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAsset && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Delete Asset?</h3>
            <p className="py-4 text-base-content/70">
              Are you sure you want to delete <strong>{deletingAsset.name}</strong>? This action cannot be undone.
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setDeletingAsset(null)}>
                Cancel
              </button>
              <button className="btn btn-error" onClick={() => void confirmDelete()}>
                Delete
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setDeletingAsset(null)} />
        </div>
      )}

      {/* Preview Modal */}
      {previewAsset && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl w-full bg-base-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg truncate pr-4">{previewAsset.name}</h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setPreviewAsset(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-center bg-base-300 rounded-lg overflow-hidden min-h-[200px] max-h-[60vh]">
              {previewAsset.fileType.startsWith("image/") ? (
                <img
                  src={previewAsset.fileUrl}
                  alt={previewAsset.name}
                  className="max-w-full max-h-[60vh] object-contain"
                />
              ) : previewAsset.fileType === "application/pdf" ? (
                <iframe
                  src={previewAsset.fileUrl}
                  title={previewAsset.name}
                  className="w-full h-[60vh]"
                />
              ) : previewAsset.fileType.startsWith("video/") ? (
                <video
                  src={previewAsset.fileUrl}
                  controls
                  className="max-w-full max-h-[60vh]"
                />
              ) : previewAsset.fileType.startsWith("audio/") ? (
                <audio src={previewAsset.fileUrl} controls className="w-full px-8" />
              ) : null}
            </div>
            <div className="modal-action">
              <button
                className="btn btn-primary btn-sm gap-2"
                onClick={() => void downloadFile(previewAsset.fileUrl, previewAsset.name)}
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setPreviewAsset(null)} />
        </div>
      )}
    </div>
  );
}

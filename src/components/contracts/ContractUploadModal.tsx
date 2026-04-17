"use client";

import { useState, useEffect } from "react";
import { X, Search, FileText, Upload } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import toast from "react-hot-toast";

interface User {
  id: string;
  name: string;
  email: string;
  profilePicUrl: string | null;
}

interface ContractUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedUserId?: string;
}

export function ContractUploadModal({ isOpen, onClose, onSuccess, preselectedUserId }: ContractUploadModalProps) {
  const [title, setTitle] = useState("");
  const [userId, setUserId] = useState(preselectedUserId || "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (preselectedUserId) setUserId(preselectedUserId);
  }, [preselectedUserId]);

  useEffect(() => {
    if (!isOpen) return;
    // Initial fetch of some employees
    setSearching(true);
    fetch("/api/admin/users?limit=50")
      .then((r) => r.json())
      .then((d) => {
        // Filter out clients
        const nonClients = (d.data || []).filter((u: any) => u.role !== "CLIENT");
        setUsers(nonClients);
      })
      .finally(() => setSearching(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || search.length < 2) return;
    const timeoutId = setTimeout(() => {
      setSearching(true);
      fetch(`/api/admin/users?q=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then((d) => {
          const nonClients = (d.data || []).filter((u: any) => u.role !== "CLIENT");
          setUsers(nonClients);
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search, isOpen]);

  async function handleUpload() {
    if (!userId || !title || !file) {
      toast.error("Please fill all fields");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("title", title);
    formData.append("file", file);

    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      
      toast.success("Contract uploaded successfully");
      onSuccess();
      onClose();
      // Reset
      setTitle("");
      setUserId("");
      setFile(null);
      setSearch("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-200 max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Contract
          </h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* User Search */}
          {!preselectedUserId && (
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text font-medium">Assign to User</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-base-content/40">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  className="input input-bordered w-full pl-10 bg-base-100"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Search Results */}
              {(users.length > 0 || searching) && !userId && (
                <div className="mt-2 bg-base-100 rounded-lg border border-base-300 max-h-60 overflow-y-auto divide-y divide-base-300 shadow-sm">
                  {searching ? (
                    <div className="p-4 text-center">
                      <span className="loading loading-spinner loading-sm text-primary" />
                    </div>
                  ) : (
                    users.map((u) => (
                      <button
                        key={u.id}
                        className="w-full flex items-center gap-3 p-3 hover:bg-base-200 text-left transition-colors"
                        onClick={() => {
                          setUserId(u.id);
                          setSearch(u.name);
                        }}
                      >
                        <UserAvatar 
                          user={{ name: u.name, profilePicUrl: u.profilePicUrl }} 
                          size={32} 
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-base-content truncate">{u.name}</p>
                          <p className="text-[10px] text-base-content/50 uppercase tracking-wider">
                            {u.role.replace(/_/g, " ")}
                          </p>
                        </div>
                        <div className="text-primary text-xs font-medium opacity-0 group-hover:opacity-100">Select</div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {userId && !preselectedUserId && (
                <div className="mt-2 flex items-center justify-between bg-primary/10 p-2 rounded-lg border border-primary/20">
                  <span className="text-sm font-medium text-primary flex items-center gap-2">
                    Selected: {search}
                  </span>
                  <button className="btn btn-ghost btn-xs text-error" onClick={() => setUserId("")}>
                    Change
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-medium">Contract Title</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Employment Agreement 2024"
              className="input input-bordered w-full bg-base-100"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* File */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-medium">PDF File</span>
            </label>
            <div 
              className="border-2 border-dashed border-base-content/20 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors bg-base-100"
              onClick={() => document.getElementById("contract-file")?.click()}
            >
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-10 h-10 text-primary" />
                  <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                  <button 
                    className="btn btn-ghost btn-xs text-error" 
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-10 h-10 text-base-content/20" />
                  <p className="text-sm text-base-content/60">Click to upload PDF</p>
                  <p className="text-xs text-base-content/40">Max 10MB</p>
                </div>
              )}
              <input
                id="contract-file"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading || !userId || !title || !file}
          >
            {uploading && <span className="loading loading-spinner loading-sm" />}
            Upload Contract
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}

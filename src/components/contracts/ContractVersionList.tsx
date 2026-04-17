"use client";

import { useState } from "react";
import { FileText, Download, Calendar, User, Plus, Upload, X } from "lucide-react";
import toast from "react-hot-toast";

interface ContractVersion {
  id: string;
  version: number;
  storagePath: string;
  createdAt: string;
  url: string | null;
  uploadedBy: {
    id: string;
    name: string;
  };
}

interface ContractVersionListProps {
  contractId: string;
  versions: ContractVersion[];
  canManage: boolean;
  onRefresh: () => void;
}

export function ContractVersionList({ contractId, versions, canManage, onRefresh }: ContractVersionListProps) {
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);

  async function handleNewVersion() {
    if (!newFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", newFile);

    try {
      const res = await fetch(`/api/contracts/${contractId}/versions`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      toast.success("New version uploaded");
      setShowUpload(false);
      setNewFile(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-base-content/50 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Version History
        </h4>
        {canManage && (
          <button 
            className="btn btn-primary btn-xs gap-1"
            onClick={() => setShowUpload(true)}
          >
            <Plus className="w-3 h-3" />
            New Version
          </button>
        )}
      </div>

      <div className="space-y-2">
        {versions.map((v) => (
          <div 
            key={v.id} 
            className="flex items-center justify-between p-3 bg-base-100 rounded-lg border border-base-300 hover:border-primary/30 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-base-200 flex items-center justify-center text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-sm">Version {v.version}</p>
                <div className="flex items-center gap-2 text-xs text-base-content/50">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {v.uploadedBy.name}
                  </span>
                </div>
              </div>
            </div>
            
            {v.url ? (
              <a 
                href={v.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-ghost btn-sm btn-circle text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                title="Download PDF"
              >
                <Download className="w-4 h-4" />
              </a>
            ) : (
              <span className="text-xs text-error opacity-60">Expired</span>
            )}
          </div>
        ))}
      </div>

      {/* New Version Modal Overlay */}
      {showUpload && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-base-200 p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Version {versions[0]?.version + 1}
              </h3>
              <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setShowUpload(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div 
              className="border-2 border-dashed border-base-content/20 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors bg-base-100 mb-4"
              onClick={() => document.getElementById("new-version-file")?.click()}
            >
              {newFile ? (
                <div className="flex flex-col items-center gap-2 text-sm">
                  <FileText className="w-8 h-8 text-primary" />
                  <p className="font-medium truncate max-w-full px-4">{newFile.name}</p>
                </div>
              ) : (
                <p className="text-xs text-base-content/50">Click to select PDF</p>
              )}
              <input
                id="new-version-file"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setNewFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowUpload(false)}>Cancel</button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={handleNewVersion}
                disabled={uploading || !newFile}
              >
                {uploading && <span className="loading loading-spinner loading-sm" />}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

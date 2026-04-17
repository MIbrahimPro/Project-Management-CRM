"use client";

import { useState, useEffect } from "react";
import { 
  FileText, Plus, Search, User, Calendar, 
  ChevronDown, ChevronUp, Download, ExternalLink, Shield 
} from "lucide-react";
import toast from "react-hot-toast";
import { ContractUploadModal } from "@/components/contracts/ContractUploadModal";
import { ContractVersionList } from "@/components/contracts/ContractVersionList";
import { UserAvatar } from "@/components/ui/UserAvatar";

export default function ContractsPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [expandedContract, setExpandedContract] = useState<string | null>(null);

  useEffect(() => {
    fetchContracts();
  }, []);

  async function fetchContracts() {
    setLoading(true);
    try {
      const res = await fetch("/api/contracts");
      const data = await res.json();
      setContracts(data.data || []);
    } catch (err) {
      toast.error("Failed to load contracts");
    } finally {
      setLoading(false);
    }
  }

  const filteredContracts = contracts.filter((c) => 
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.user.name.toLowerCase().includes(search.toLowerCase()) ||
    c.user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-base-content">Contracts</h1>
          <p className="text-sm text-base-content/60">Manage employee agreements and legal documents.</p>
        </div>
        <button 
          className="btn btn-primary gap-2"
          onClick={() => setIsUploadOpen(true)}
        >
          <Plus className="w-4 h-4" />
          New Contract
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-base-200 p-4 rounded-xl border border-base-300">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
          <input
            type="text"
            placeholder="Search by title, name or email..."
            className="input input-bordered w-full pl-10 bg-base-100"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : filteredContracts.length === 0 ? (
        <div className="card bg-base-200 border-2 border-dashed border-base-content/10 py-16 text-center">
          <FileText className="w-12 h-12 text-base-content/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-base-content/60">No contracts found</h3>
          <p className="text-sm text-base-content/40">Try searching for something else or upload a new contract.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredContracts.map((c) => (
            <div 
              key={c.id} 
              className={`card bg-base-200 border transition-all ${
                c.isMissing ? "border-error/50 ring-1 ring-error/20 shadow-error/5" : "border-base-300"
              } ${
                expandedContract === c.id ? "ring-2 ring-primary/20 shadow-lg" : "hover:shadow-sm"
              }`}
            >
              <div className="card-body p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base-content truncate">{c.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="badge badge-sm badge-neutral">v{c.currentVersion}</span>
                          <span className={`badge badge-sm ${c.status === "SIGNED" ? "badge-success" : "badge-warning"}`}>
                            {c.status}
                          </span>
                          <span className="text-xs text-base-content/40">Updated {new Date(c.updatedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6">
                    {/* User info */}
                    <div className="flex items-center gap-3">
                      <UserAvatar 
                        user={{ name: c.user.name, profilePicUrl: c.user.profilePicUrl }} 
                        size={32} 
                      />
                      <div className="hidden sm:block text-right">
                        <p className="text-sm font-medium">{c.user.name}</p>
                        <p className="text-xs text-base-content/50">{c.user.role.replace(/_/g, " ").toLowerCase()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {c.isMissing ? (
                        <button 
                          className="btn btn-primary btn-sm gap-2"
                          onClick={() => {
                            setSelectedUserId(c.userId);
                            setIsUploadOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          Create
                        </button>
                      ) : (
                        <button 
                          className={`btn btn-circle btn-sm ${expandedContract === c.id ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => setExpandedContract(expandedContract === c.id ? null : c.id)}
                          title={expandedContract === c.id ? "Collapse" : "Expand History"}
                        >
                          {expandedContract === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {expandedContract === c.id && (
                  <div className="mt-6 pt-6 border-t border-base-300 animate-in slide-in-from-top-4 duration-300">
                    <ContractVersionList 
                      contractId={c.id} 
                      versions={c.versions || []} 
                      canManage={true} 
                      onRefresh={fetchContracts} 
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ContractUploadModal 
        isOpen={isUploadOpen} 
        onClose={() => {
          setIsUploadOpen(false);
          setSelectedUserId(undefined);
        }} 
        onSuccess={fetchContracts} 
        preselectedUserId={selectedUserId}
      />
    </div>
  );
}

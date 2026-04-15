"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Bot,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  StickyNote,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type Question = { id: string; text: string; required: boolean; order: number };
type CandidateAnswer = { answer: string; question: { text: string } };
type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  isAiRecommended: boolean;
  isHrRecommended: boolean;
  appliedAt: string;
  interviewAt: string | null;
  internalNotes: string | null;
  cvUrl: string | null;
  answers: CandidateAnswer[];
};
type HiringRequest = {
  id: string;
  statedRole: string;
  role: string;
  status: string;
  publicSlug: string | null;
  publicTitle: string | null;
  publicDescription: string | null;
  description: string | null;
  managerApproved: boolean;
  hrApproved: boolean;
  adminApproved: boolean;
  deadline: string | null;
  requestedBy: { id: string; name: string };
  questions: Question[];
  candidates: Candidate[];
};

type AIRanking = { candidateId: string; name: string; score: number; reasoning: string };

const STATUS_OPTS = [
  "APPLIED", "UNDER_REVIEW", "AI_RECOMMENDED", "HR_RECOMMENDED",
  "SHORTLISTED", "INTERVIEW_SCHEDULED", "HIRED", "REJECTED",
] as const;

const STATUS_BADGE: Record<string, string> = {
  APPLIED: "badge-neutral",
  UNDER_REVIEW: "badge-info",
  AI_RECOMMENDED: "badge-secondary",
  HR_RECOMMENDED: "badge-primary",
  SHORTLISTED: "badge-success",
  INTERVIEW_SCHEDULED: "badge-warning",
  HIRED: "badge-success",
  REJECTED: "badge-error",
};

const REQUEST_STATUS_BADGE: Record<string, string> = {
  DRAFT: "badge-neutral",
  PENDING_APPROVAL: "badge-warning",
  OPEN: "badge-success",
  CLOSED: "badge-info",
  CANCELLED: "badge-error",
};

export default function HiringRequestPage() {
  const params = useParams<{ id: string }>();
  const requestId = params?.id ?? "";

  const [request, setRequest] = useState<HiringRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [aiRankings, setAiRankings] = useState<AIRanking[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Notes editor
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Publish state
  const [publishing, setPublishing] = useState(false);

  // CV modal
  const [cvModalUrl, setCvModalUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/hr/requests/${requestId}`)
      .then((r) => r.json())
      .then((d: { data?: HiringRequest; error?: string }) => {
        if (d.data) setRequest(d.data);
        else toast.error("Failed to load", { style: TOAST_ERROR_STYLE });
      })
      .catch(() => toast.error("Failed to load", { style: TOAST_ERROR_STYLE }))
      .finally(() => setLoading(false));
  }, [requestId]);

  async function updateCandidateStatus(candidateId: string, status: string) {
    try {
      const res = await fetch(`/api/hr/requests/${requestId}/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { data: Partial<Candidate> };
      setRequest((prev) =>
        prev
          ? {
              ...prev,
              candidates: prev.candidates.map((c) =>
                c.id === candidateId ? { ...c, ...data.data } : c
              ),
            }
          : prev
      );
      if (selectedCandidate?.id === candidateId) {
        setSelectedCandidate((prev) => (prev ? { ...prev, ...data.data } : prev));
      }
      toast.success("Status updated", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to update status", { style: TOAST_ERROR_STYLE });
    }
  }

  async function saveNotes() {
    if (!selectedCandidate) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/hr/requests/${requestId}/candidates/${selectedCandidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNotes: notesDraft }),
      });
      if (!res.ok) throw new Error("Failed");
      setRequest((prev) =>
        prev
          ? {
              ...prev,
              candidates: prev.candidates.map((c) =>
                c.id === selectedCandidate.id ? { ...c, internalNotes: notesDraft } : c
              ),
            }
          : prev
      );
      setSelectedCandidate((prev) => (prev ? { ...prev, internalNotes: notesDraft } : prev));
      setEditingNotes(false);
      toast.success("Notes saved", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to save notes", { style: TOAST_ERROR_STYLE });
    } finally {
      setSavingNotes(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/hr/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish: true }),
      });
      const data = (await res.json()) as { data?: Partial<HiringRequest>; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setRequest((prev) =>
        prev ? { ...prev, ...data.data } : prev
      );
      toast.success("Job published! Sharing link is ready.", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setPublishing(false);
    }
  }

  async function runAiRecommend() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/hr-recommend-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const data = (await res.json()) as { data?: AIRanking[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "AI failed");
      setAiRankings(data.data ?? []);
      // Refresh candidates to get updated statuses
      const updated = await fetch(`/api/hr/requests/${requestId}`).then((r) => r.json()) as { data?: HiringRequest };
      if (updated.data) setRequest(updated.data);
      toast.success("AI recommendations ready", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setAiLoading(false);
    }
  }

  function copyShareLink() {
    if (!request?.publicSlug) return;
    const url = `${window.location.origin}/careers/${request.publicSlug}`;
    void navigator.clipboard.writeText(url);
    toast.success("Link copied!", { style: TOAST_STYLE });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-16 text-base-content/40">
        <p>Hiring request not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-base-content">
              {request.publicTitle ?? request.statedRole}
            </h1>
            <span className={`badge ${REQUEST_STATUS_BADGE[request.status] ?? "badge-neutral"} badge-sm`}>
              {request.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-sm text-base-content/50 mt-1">
            Requested by {request.requestedBy.name}
            {request.deadline && ` · Deadline ${new Date(request.deadline).toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {request.status !== "OPEN" && request.status !== "CLOSED" && request.status !== "CANCELLED" && (
            <button
              className="btn btn-sm btn-outline gap-2"
              onClick={() => void publish()}
              disabled={publishing}
            >
              {publishing ? <span className="loading loading-spinner loading-xs" /> : <Globe className="w-4 h-4" />}
              Publish
            </button>
          )}
          {request.publicSlug && (
            <>
              <button className="btn btn-sm btn-ghost gap-2" onClick={copyShareLink}>
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
              <a
                href={`/careers/${request.publicSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-ghost gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Preview
              </a>
            </>
          )}
        </div>
      </div>

      {/* Approvals row */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Manager", approved: request.managerApproved },
          { label: "HR", approved: request.hrApproved },
          { label: "Admin", approved: request.adminApproved },
        ].map(({ label, approved }) => (
          <div
            key={label}
            className={`badge gap-1 ${approved ? "badge-success" : "badge-neutral"}`}
          >
            {approved ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            {label} {approved ? "Approved" : "Pending"}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Candidates list */}
        <div className="lg:col-span-1 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base-content">
              Candidates ({request.candidates.length})
            </h2>
            <button
              className="btn btn-xs btn-primary gap-1"
              onClick={() => void runAiRecommend()}
              disabled={aiLoading || request.candidates.length === 0}
            >
              {aiLoading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Bot className="w-3 h-3" />
              )}
              AI Rank
            </button>
          </div>

          {request.candidates.length === 0 ? (
            <div className="card bg-base-200">
              <div className="card-body items-center py-8 text-base-content/40 text-sm">
                No candidates yet
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {request.candidates.map((c) => {
                const ranking = aiRankings?.find((r) => r.candidateId === c.id);
                return (
                  <button
                    key={c.id}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      selectedCandidate?.id === c.id
                        ? "border-primary bg-primary/10"
                        : "border-base-300 bg-base-200 hover:bg-base-300"
                    }`}
                    onClick={() => {
                      setSelectedCandidate(c);
                      setEditingNotes(false);
                      setNotesDraft(c.internalNotes ?? "");
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                        {c.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-base-content truncate">{c.name}</span>
                          {c.isAiRecommended && (
                            <Bot className="w-3 h-3 text-secondary flex-shrink-0" />
                          )}
                          {ranking && (
                            <span className="text-xs badge badge-secondary badge-sm">{ranking.score}/10</span>
                          )}
                        </div>
                        <span className={`badge badge-xs ${STATUS_BADGE[c.status] ?? "badge-neutral"}`}>
                          {c.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    {ranking && (
                      <p className="text-xs text-base-content/50 mt-1 text-left truncate">{ranking.reasoning}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Candidate detail */}
        <div className="lg:col-span-2">
          {selectedCandidate ? (
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body gap-4">
                {/* Name + status */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-lg text-base-content">{selectedCandidate.name}</h3>
                    <p className="text-sm text-base-content/60">{selectedCandidate.email}</p>
                    {selectedCandidate.phone && (
                      <p className="text-sm text-base-content/60">{selectedCandidate.phone}</p>
                    )}
                    <p className="text-xs text-base-content/40 mt-1">
                      Applied {new Date(selectedCandidate.appliedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedCandidate.cvUrl && (
                      <button
                        className="btn btn-xs btn-outline gap-1"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(selectedCandidate.cvUrl!)}`);
                            const data = await res.json();
                            if (data?.url) setCvModalUrl(data.url);
                          } catch { /* ignore */ }
                        }}
                      >
                        <FileText className="w-3 h-3" />
                        View CV
                      </button>
                    )}
                    {/* Status dropdown */}
                    <div className="dropdown dropdown-end">
                      <label tabIndex={0} className={`btn btn-xs gap-1 ${STATUS_BADGE[selectedCandidate.status] ? "" : "btn-neutral"}`}>
                        <span className={`badge badge-xs ${STATUS_BADGE[selectedCandidate.status] ?? "badge-neutral"}`}>
                          {selectedCandidate.status.replace("_", " ")}
                        </span>
                        <ChevronDown className="w-3 h-3" />
                      </label>
                      <ul
                        tabIndex={0}
                        className="dropdown-content menu bg-base-200 border border-base-300 rounded-box w-44 shadow-lg z-50"
                      >
                        {STATUS_OPTS.map((s) => (
                          <li key={s}>
                            <button
                              className={selectedCandidate.status === s ? "active" : ""}
                              onClick={() => void updateCandidateStatus(selectedCandidate.id, s)}
                            >
                              <span className={`badge badge-xs ${STATUS_BADGE[s]}`} />
                              {s.replace("_", " ")}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Interview date */}
                {selectedCandidate.interviewAt && (
                  <div className="flex items-center gap-2 text-sm text-base-content/70">
                    <Calendar className="w-4 h-4 text-warning" />
                    Interview: {new Date(selectedCandidate.interviewAt).toLocaleString()}
                  </div>
                )}

                {/* Answers */}
                {selectedCandidate.answers.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-base-content">Application Answers</h4>
                    {selectedCandidate.answers.map((a, i) => (
                      <div key={i} className="bg-base-300 rounded-lg p-3 space-y-1">
                        <p className="text-xs font-medium text-base-content/60">{a.question.text}</p>
                        <p className="text-sm text-base-content whitespace-pre-wrap">{a.answer}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Internal notes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-base-content flex items-center gap-1">
                      <StickyNote className="w-3.5 h-3.5" />
                      Internal Notes
                    </h4>
                    {!editingNotes && (
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => {
                          setNotesDraft(selectedCandidate.internalNotes ?? "");
                          setEditingNotes(true);
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        className="textarea textarea-bordered bg-base-100 w-full min-h-[100px] text-sm"
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Internal notes visible to HR team only..."
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button className="btn btn-ghost btn-xs" onClick={() => setEditingNotes(false)}>
                          Cancel
                        </button>
                        <button
                          className="btn btn-primary btn-xs"
                          onClick={() => void saveNotes()}
                          disabled={savingNotes}
                        >
                          {savingNotes && <span className="loading loading-spinner loading-xs" />}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-base-300 rounded-lg p-3 min-h-[60px]">
                      {selectedCandidate.internalNotes ? (
                        <p className="text-sm text-base-content/80 whitespace-pre-wrap">
                          {selectedCandidate.internalNotes}
                        </p>
                      ) : (
                        <p className="text-sm text-base-content/30 italic">No notes yet</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body items-center py-16 text-base-content/30">
                <p className="text-sm">Select a candidate to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CV Preview Modal */}
      {cvModalUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={() => setCvModalUrl(null)}>
          <div className="relative w-[90vw] h-[90vh] max-w-4xl bg-base-100 rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 bg-base-200 border-b border-base-300">
              <span className="text-sm font-medium text-base-content">CV Preview</span>
              <div className="flex gap-2">
                <a href={cvModalUrl} download className="btn btn-xs btn-ghost gap-1" target="_blank" rel="noopener noreferrer">
                  <Download className="w-3 h-3" /> Download
                </a>
                <button className="btn btn-xs btn-ghost btn-circle" onClick={() => setCvModalUrl(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <iframe src={cvModalUrl} className="w-full h-[calc(100%-2.5rem)]" title="CV Preview" />
          </div>
        </div>
      )}
    </div>
  );
}

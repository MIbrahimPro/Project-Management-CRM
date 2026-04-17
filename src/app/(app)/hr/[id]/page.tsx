"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Bot, Calendar, Check, ChevronDown, Copy, Download,
  ExternalLink, FileText, Globe, StickyNote, X, Video, UserPlus, Clock
} from "lucide-react";
import toast from "react-hot-toast";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type Question = { id: string; text: string; required: boolean; order: number };
type CandidateAnswer = { answer: string; question: { text: string } };
type Interview = { id: string; startTime: string; endTime: string; roomId: string | null; status: string };
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
  interviews: Interview[];
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
type UserMin = { id: string; name: string };

const STATUS_OPTS = [
  "APPLIED", "UNDER_REVIEW", "SHORTLISTED", 
  "INTERVIEW_SCHEDULED", "HIRED", "REJECTED",
] as const;

const STATUS_BADGE: Record<string, string> = {
  APPLIED: "badge-neutral",
  UNDER_REVIEW: "badge-info",
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

  // Scheduling Modal
  const [scheduleModalCand, setScheduleModalCand] = useState<Candidate | null>(null);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");
  const [interviewerIds, setInterviewerIds] = useState<string[]>([]);
  const [interviewersList, setInterviewersList] = useState<UserMin[]>([]);
  const [scheduling, setScheduling] = useState(false);

  // Hiring Modal
  const [hireModalCand, setHireModalCand] = useState<Candidate | null>(null);
  const [hireSalary, setHireSalary] = useState("");
  const [hireWorkMode, setHireWorkMode] = useState<"ONSITE" | "REMOTE" | "HYBRID">("REMOTE");
  const [hireMemberSince, setHireMemberSince] = useState(new Date().toISOString().slice(0, 10));
  const [hiring, setHiring] = useState(false);

  const [startingMeeting, setStartingMeeting] = useState<string | null>(null);

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

  useEffect(() => {
    if (scheduleModalCand && interviewersList.length === 0) {
      fetch("/api/users/team-members").then(r => r.json()).then(d => {
        if (d.data) setInterviewersList(d.data);
      });
    }
  }, [scheduleModalCand, interviewersList.length]);

  async function updateCandidateStatus(candidateId: string, status: string, isHrRecommended?: boolean) {
    try {
      const bodyPayload: any = { status };
      if (isHrRecommended !== undefined) bodyPayload.isHrRecommended = isHrRecommended;

      const res = await fetch(`/api/hr/requests/${requestId}/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
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
      toast.success("Candidate updated", { style: TOAST_STYLE });
    } catch {
      toast.error("Failed to update candidate", { style: TOAST_ERROR_STYLE });
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

  async function handleScheduleInterview(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleModalCand || interviewerIds.length === 0) return;
    setScheduling(true);
    try {
      const start = new Date(`${interviewDate}T${interviewTime}`);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour
      const res = await fetch("/api/hr/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: scheduleModalCand.id,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          interviewerIds
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scheduling failed");

      // Reload request to get updated interviews
      const updated = await fetch(`/api/hr/requests/${requestId}`).then((r) => r.json()) as { data?: HiringRequest };
      if (updated.data) {
        setRequest(updated.data);
        if (selectedCandidate?.id === scheduleModalCand.id) {
          setSelectedCandidate(updated.data.candidates.find(c => c.id === scheduleModalCand.id) || null);
        }
      }
      setScheduleModalCand(null);
      toast.success("Interview scheduled and email sent!", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error scheduling", { style: TOAST_ERROR_STYLE });
    } finally {
      setScheduling(false);
    }
  }

  async function handleStartMeeting(interviewId: string) {
    setStartingMeeting(interviewId);
    try {
      const res = await fetch(`/api/hr/interviews/${interviewId}/start`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start meeting");
      toast.success("Meeting started, candidate notified", { style: TOAST_STYLE });
      // Open in new tab
      window.open(`/meet/${data.data.roomId}`, "_blank");
      
      // Reload request to update roomId
      const updated = await fetch(`/api/hr/requests/${requestId}`).then((r) => r.json()) as { data?: HiringRequest };
      if (updated.data) {
        setRequest(updated.data);
        if (selectedCandidate) {
          setSelectedCandidate(updated.data.candidates.find(c => c.id === selectedCandidate.id) || null);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error", { style: TOAST_ERROR_STYLE });
    } finally {
      setStartingMeeting(null);
    }
  }

  async function handleHire(e: React.FormEvent) {
    e.preventDefault();
    if (!hireModalCand) return;
    setHiring(true);
    try {
      const res = await fetch(`/api/hr/requests/${requestId}/candidates/${hireModalCand.id}/hire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salary: hireSalary,
          workMode: hireWorkMode,
          memberSince: new Date(hireMemberSince).toISOString()
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hiring failed");

      // Reload
      const updated = await fetch(`/api/hr/requests/${requestId}`).then((r) => r.json()) as { data?: HiringRequest };
      if (updated.data) {
        setRequest(updated.data);
        if (selectedCandidate?.id === hireModalCand.id) {
          setSelectedCandidate(updated.data.candidates.find(c => c.id === hireModalCand.id) || null);
        }
      }
      setHireModalCand(null);
      toast.success("Candidate Hired! Welcome email sent.", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error hiring", { style: TOAST_ERROR_STYLE });
    } finally {
      setHiring(false);
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
                          {c.isHrRecommended && (
                            <span className="text-xs badge badge-primary badge-sm">HR Rec</span>
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
                    {/* HR Recommended toggle */}
                    <button
                      className={`btn btn-xs gap-1 ${selectedCandidate.isHrRecommended ? "btn-primary" : "btn-outline"}`}
                      onClick={() => void updateCandidateStatus(selectedCandidate.id, selectedCandidate.status, !selectedCandidate.isHrRecommended)}
                    >
                      <Check className="w-3 h-3" />
                      HR Rec
                    </button>
                  </div>
                </div>

                {/* Interviews */}
                {selectedCandidate.interviews && selectedCandidate.interviews.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-base-content flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Interviews
                    </h4>
                    {selectedCandidate.interviews.map(inv => {
                      const start = new Date(inv.startTime);
                      const isComingUp = start.getTime() - Date.now() < 30 * 60 * 1000 && start.getTime() > Date.now() - 60 * 60 * 1000;
                      return (
                        <div key={inv.id} className="bg-base-300 rounded-lg p-3 flex justify-between items-center">
                          <div className="text-sm text-base-content/80">
                            {start.toLocaleString()} - {inv.status}
                          </div>
                          <div className="flex gap-2">
                            {inv.roomId && (
                              <button className="btn btn-xs btn-outline gap-1" onClick={() => window.open(`/meet/${inv.roomId}`, "_blank")}>
                                <Video className="w-3 h-3" /> Join Room
                              </button>
                            )}
                            {!inv.roomId && isComingUp && (
                              <button 
                                className="btn btn-xs btn-primary gap-1"
                                onClick={() => void handleStartMeeting(inv.id)}
                                disabled={startingMeeting === inv.id}
                              >
                                {startingMeeting === inv.id ? <span className="loading loading-spinner loading-xs" /> : <Video className="w-3 h-3" />}
                                Start Meeting
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Action Buttons Row */}
                <div className="flex gap-2 flex-wrap">
                  <button 
                    className="btn btn-sm btn-outline gap-1"
                    onClick={() => {
                      setScheduleModalCand(selectedCandidate);
                    }}
                  >
                    <Clock className="w-4 h-4" /> Schedule Interview
                  </button>
                  {selectedCandidate.status === "SHORTLISTED" || selectedCandidate.status === "INTERVIEW_SCHEDULED" ? (
                    <button 
                      className="btn btn-sm btn-primary gap-1"
                      onClick={() => setHireModalCand(selectedCandidate)}
                    >
                      <UserPlus className="w-4 h-4" /> Hire Candidate
                    </button>
                  ) : null}
                </div>

                <div className="divider my-0"></div>

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

      {/* Schedule Modal */}
      {scheduleModalCand && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Schedule Interview for {scheduleModalCand.name}</h3>
            <form onSubmit={(e) => void handleScheduleInterview(e)} className="space-y-4">
              <div className="flex gap-4">
                <div className="form-control flex-1">
                  <label className="label"><span className="label-text">Date</span></label>
                  <input type="date" className="input input-bordered" required value={interviewDate} onChange={e => setInterviewDate(e.target.value)} />
                </div>
                <div className="form-control flex-1">
                  <label className="label"><span className="label-text">Time</span></label>
                  <input type="time" className="input input-bordered" required value={interviewTime} onChange={e => setInterviewTime(e.target.value)} />
                </div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Interviewers</span></label>
                <select multiple className="select select-bordered h-32" required value={interviewerIds} onChange={e => setInterviewerIds(Array.from(e.target.selectedOptions, o => o.value))}>
                  {interviewersList.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <label className="label"><span className="label-text-alt text-base-content/50">Hold Ctrl/Cmd to select multiple</span></label>
              </div>
              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={() => setScheduleModalCand(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={scheduling}>
                  {scheduling && <span className="loading loading-spinner loading-xs" />}
                  Schedule & Email Candidate
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => setScheduleModalCand(null)}></div>
        </div>
      )}

      {/* Hire Modal */}
      {hireModalCand && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Hire {hireModalCand.name}</h3>
            <form onSubmit={(e) => void handleHire(e)} className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Salary</span></label>
                <input type="text" placeholder="e.g. $5,000/mo" className="input input-bordered" required value={hireSalary} onChange={e => setHireSalary(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Work Mode</span></label>
                <select className="select select-bordered" required value={hireWorkMode} onChange={e => setHireWorkMode(e.target.value as any)}>
                  <option value="ONSITE">Onsite</option>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Member Since</span></label>
                <input type="date" className="input input-bordered" required value={hireMemberSince} onChange={e => setHireMemberSince(e.target.value)} />
              </div>
              <div className="bg-success/10 border border-success/20 p-3 rounded-lg mt-2">
                <p className="text-sm text-success font-medium">This will create a new account and send a welcome email containing their secure setup link.</p>
              </div>
              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={() => setHireModalCand(null)}>Cancel</button>
                <button type="submit" className="btn btn-success text-white" disabled={hiring}>
                  {hiring && <span className="loading loading-spinner loading-xs" />}
                  Confirm Hire & Email
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => setHireModalCand(null)}></div>
        </div>
      )}
    </div>
  );
}

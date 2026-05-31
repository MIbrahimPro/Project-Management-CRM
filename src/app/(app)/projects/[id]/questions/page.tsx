"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useSocket } from "@/hooks/useSocket";
import { QuestionCard } from "@/components/projects/QuestionCard";

dayjs.extend(relativeTime);

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type Answer = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; role: string };
};

type QuestionCreator = { id: string; name: string; role: string };

type Question = {
  id: string;
  text: string;
  partOf: string;
  isApproved: boolean;
  isAiGenerated: boolean;
  answers: Answer[];
  milestone: { id: string; order: number; title: string } | null;
  createdBy?: QuestionCreator | null;
  createdAt: string;
  updatedAt: string;
};

type Milestone = { id: string; order: number; title: string };

type UserMe = { id: string; role: string };

function QuestionsInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = params?.id ?? "";
  const highlightId = searchParams.get("highlight");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [user, setUser] = useState<UserMe | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [newPartOf, setNewPartOf] = useState("start");

  // Per-question answering state
  const [answering, setAnswering] = useState<string | null>(null);
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [showHistory, setShowHistory] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editPartOf, setEditPartOf] = useState("start");
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation modal
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { socket } = useSocket("/chat");

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/questions`).then((r) => r.json()),
      fetch("/api/users/me").then((r) => r.json()),
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
    ])
      .then(
        ([qRes, uRes, pRes]: [
          { data: Question[] },
          { data: UserMe },
          { data: { milestones: Milestone[] } },
        ]) => {
          setQuestions(qRes.data ?? []);
          setUser(uRes.data);
          setMilestones(pRes.data?.milestones ?? []);
        }
      )
      .catch(() => toast.error("Failed to load", { style: TOAST_ERROR_STYLE }))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Socket listeners for real-time question updates (server auto-joins project rooms)
  useEffect(() => {
    if (!socket || !projectId || !user) return;

    const isClient = user.role === "CLIENT";

    const onQuestionAdded = (question: Question) => {
      if (isClient && !question.isApproved) return;
      setQuestions((prev) => {
        if (prev.some((q) => q.id === question.id)) return prev;
        return [...prev, question];
      });
    };

    const onQuestionApproved = (question: Question) => {
      setQuestions((prev) => {
        const idx = prev.findIndex((q) => q.id === question.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = question;
          return next;
        }
        return [...prev, question];
      });
    };

    const onQuestionAnswered = (data: { questionId: string; answer: Answer }) => {
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== data.questionId) return q;
          const idx = q.answers?.findIndex((a) => a.id === data.answer.id);
          if (idx !== undefined && idx !== -1) {
            const next = [...(q.answers ?? [])];
            next[idx] = data.answer;
            return { ...q, answers: next };
          }
          return { ...q, answers: [data.answer, ...(q.answers ?? [])] };
        })
      );
    };

    const onQuestionUpdated = (question: Question) => {
      if (isClient && !question.isApproved) return;
      setQuestions((prev) =>
        prev.map((q) => (q.id === question.id ? question : q))
      );
    };

    const onQuestionDeleted = (data: { questionId: string }) => {
      setQuestions((prev) => prev.filter((q) => q.id !== data.questionId));
    };

    socket.on("question_added", onQuestionAdded);
    socket.on("question_approved", onQuestionApproved);
    socket.on("question_answered", onQuestionAnswered);
    socket.on("question_updated", onQuestionUpdated);
    socket.on("question_deleted", onQuestionDeleted);

    return () => {
      socket.off("question_added", onQuestionAdded);
      socket.off("question_approved", onQuestionApproved);
      socket.off("question_answered", onQuestionAnswered);
      socket.off("question_updated", onQuestionUpdated);
      socket.off("question_deleted", onQuestionDeleted);
    };
  }, [socket, projectId, user?.role]);

  // Scroll + pulse on ?highlight=
  useEffect(() => {
    if (!highlightId || loading) return;
    const timeout = setTimeout(() => {
      const el = questionRefs.current[highlightId];
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("question-pulse");
      setTimeout(() => el.classList.remove("question-pulse"), 2500);
    }, 600);
    return () => clearTimeout(timeout);
  }, [highlightId, loading]);

  async function approveQuestion(qId: string) {
    const res = await fetch(`/api/projects/${projectId}/questions/${qId}/approve`, { method: "PATCH" });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(err.error ?? "Failed to approve", { style: TOAST_ERROR_STYLE });
      return;
    }
    setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, isApproved: true } : q)));
    toast.success("Question approved", { style: TOAST_STYLE });
    // Approval is broadcast from the API (global.io); no client relay needed
  }

  async function submitAnswer(qId: string) {
    const text = answerTexts[qId]?.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/questions/${qId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = (await res.json()) as { data?: Answer; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== qId) return q;
          const idx = q.answers?.findIndex((a) => a.id === data.data!.id);
          if (idx !== undefined && idx !== -1) {
            const next = [...(q.answers ?? [])];
            next[idx] = data.data!;
            return { ...q, answers: next };
          }
          return { ...q, answers: [data.data!, ...(q.answers ?? [])] };
        })
      );
      setAnswering(null);
      setAnswerTexts((prev) => ({ ...prev, [qId]: "" }));
      toast.success("Answer saved", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setSubmitting(false);
    }
  }

  async function addQuestion() {
    if (newText.trim().length < 5) {
      toast.error("Question too short (minimum 5 characters)", { style: TOAST_ERROR_STYLE });
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText, partOf: newPartOf }),
      });
      const data = (await res.json()) as { data?: Question; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const newQ = { ...data.data!, answers: data.data!.answers ?? [] };
      // Optimistic update - add immediately
      setQuestions((prev) => {
        if (prev.some((q) => q.id === newQ.id)) return prev;
        return [...prev, newQ];
      });
      setShowAddForm(false);
      setNewText("");
      setNewPartOf("start");
      toast.success(newQ.isApproved ? "Question added" : "Submitted for approval", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    }
  }

  async function saveEdit(qId: string) {
    if (editText.trim().length < 5) {
      toast.error("Question too short (min 5 chars)", { style: TOAST_ERROR_STYLE });
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/questions/${qId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editText, partOf: editPartOf }),
      });
      const data = (await res.json()) as { data?: Question; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setQuestions((prev) => prev.map((q) => (q.id === qId ? data.data! : q)));
      setEditing(null);
      toast.success("Question updated", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteQuestion(qId: string) {
    setDeletingId(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/questions/${qId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
      toast.success("Question deleted", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    }
  }

  const handleAnswerTextChange = useCallback((qId: string, value: string) => {
    setAnswerTexts((prev) => ({ ...prev, [qId]: value }));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const isManager = user ? ["ADMIN", "PROJECT_MANAGER"].includes(user.role) : false;
  const isClient = user?.role === "CLIENT";
  const canAnswer = isManager || isClient;

  const startQuestions = questions.filter((q) => !q.partOf.startsWith("milestone_"));
  const milestoneGroups: Record<string, Question[]> = {};
  for (const q of questions) {
    if (q.partOf.startsWith("milestone_")) {
      milestoneGroups[q.partOf] = milestoneGroups[q.partOf] ?? [];
      milestoneGroups[q.partOf].push(q);
    }
  }

  const partOfOptions = [
    { value: "start", label: "Needed to Start" },
    ...milestones.map((m) => ({
      value: `milestone_${m.order}`,
      label: `Milestone ${m.order}: ${m.title}`,
    })),
  ];

  return (
    <>
      <style>{`
        @keyframes q-pulse {
          0%,100% { box-shadow: 0 0 0 0 hsl(var(--p) / 0.3); }
          50%      { box-shadow: 0 0 0 10px hsl(var(--p) / 0); }
        }
        .question-pulse { animation: q-pulse 0.8s ease-out 3; }
      `}</style>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-base-content">Questions</h1>
          {!isClient && (
            <button
              className="btn btn-primary btn-sm gap-1"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          )}
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="card bg-base-200 border border-primary/30 shadow-sm">
            <div className="card-body gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">New Question</h3>
                <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setShowAddForm(false)}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                className="textarea textarea-bordered bg-base-100 text-sm w-full"
                rows={3}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="What do you need to know? (min 5 chars)"
                autoFocus
              />
              <select
                className="select select-bordered select-sm bg-base-100"
                value={newPartOf}
                onChange={(e) => setNewPartOf(e.target.value)}
              >
                {partOfOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {!isManager && (
                <p className="text-xs text-base-content/50">
                  Your question will be visible after manager approval.
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void addQuestion()}
                  disabled={newText.trim().length < 5}
                  title={newText.trim().length < 5 ? "Question must be at least 5 characters" : ""}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Needed to Start */}
        {startQuestions.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">Needed to Start</h2>
            {startQuestions.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                isClient={isClient}
                isManager={isManager}
                currentUserId={user?.id}
                isEditing={editing === q.id}
                editText={editText}
                editPartOf={editPartOf}
                editSaving={editSaving}
                isAnswering={answering === q.id}
                answerText={answerTexts[q.id] ?? ""}
                submitting={submitting}
                isHistoryOpen={showHistory === q.id}
                partOfOptions={partOfOptions}
                onEditStart={() => {
                  setEditing(q.id);
                  setEditText(q.text);
                  setEditPartOf(q.partOf);
                }}
                onEditTextChange={setEditText}
                onEditPartOfChange={setEditPartOf}
                onEditSave={() => void saveEdit(q.id)}
                onEditCancel={() => setEditing(null)}
                onDeleteClick={() => setDeletingId(q.id)}
                onApprove={() => void approveQuestion(q.id)}
                onAnswerStart={(latestContent) => {
                  setAnswering(q.id);
                  setAnswerTexts((prev) => ({ ...prev, [q.id]: latestContent }));
                }}
                onAnswerTextChange={(v) => handleAnswerTextChange(q.id, v)}
                onAnswerSubmit={() => void submitAnswer(q.id)}
                onAnswerCancel={() => {
                  setAnswering(null);
                  setAnswerTexts((prev) => ({ ...prev, [q.id]: "" }));
                }}
                onToggleHistory={() => setShowHistory((prev) => (prev === q.id ? null : q.id))}
                setRef={(el) => { questionRefs.current[q.id] = el; }}
              />
            ))}
          </div>
        )}

        {/* Milestone groups */}
        {milestones.map((m) => {
          const qs = milestoneGroups[`milestone_${m.order}`] ?? [];
          if (qs.length === 0) return null;
          return (
            <div key={m.id} className="space-y-2">
              <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">
                Milestone {m.order}: {m.title}
              </h2>
              {qs.map((q) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  isClient={isClient}
                  isManager={isManager}
                  currentUserId={user?.id}
                  isEditing={editing === q.id}
                  editText={editText}
                  editPartOf={editPartOf}
                  editSaving={editSaving}
                  isAnswering={answering === q.id}
                  answerText={answerTexts[q.id] ?? ""}
                  submitting={submitting}
                  isHistoryOpen={showHistory === q.id}
                  partOfOptions={partOfOptions}
                  onEditStart={() => {
                    setEditing(q.id);
                    setEditText(q.text);
                    setEditPartOf(q.partOf);
                  }}
                  onEditTextChange={setEditText}
                  onEditPartOfChange={setEditPartOf}
                  onEditSave={() => void saveEdit(q.id)}
                  onEditCancel={() => setEditing(null)}
                  onDeleteClick={() => setDeletingId(q.id)}
                  onApprove={() => void approveQuestion(q.id)}
                  onAnswerStart={(latestContent) => {
                    setAnswering(q.id);
                    setAnswerTexts((prev) => ({ ...prev, [q.id]: latestContent }));
                  }}
                  onAnswerTextChange={(v) => handleAnswerTextChange(q.id, v)}
                  onAnswerSubmit={() => void submitAnswer(q.id)}
                  onAnswerCancel={() => {
                    setAnswering(null);
                    setAnswerTexts((prev) => ({ ...prev, [q.id]: "" }));
                  }}
                  onToggleHistory={() => setShowHistory((prev) => (prev === q.id ? null : q.id))}
                  setRef={(el) => { questionRefs.current[q.id] = el; }}
                />
              ))}
            </div>
          );
        })}

        {questions.length === 0 && (
          <div className="text-center py-16 text-base-content/40">
            <div className="text-5xl mb-3">❓</div>
            <p className="text-lg">No questions yet</p>
            {!isClient && (
              <button className="btn btn-primary btn-sm mt-4" onClick={() => setShowAddForm(true)}>
                Add the first question
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Delete Question?</h3>
            <p className="py-4 text-base-content/70">
              Are you sure you want to delete this question? This action cannot be undone.
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setDeletingId(null)}>
                Cancel
              </button>
              <button className="btn btn-error" onClick={() => deleteQuestion(deletingId)}>
                Delete
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setDeletingId(null)} />
        </div>
      )}
    </>
  );
}

export default function QuestionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      }
    >
      <QuestionsInner />
    </Suspense>
  );
}

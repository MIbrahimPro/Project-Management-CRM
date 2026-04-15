"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Check, History, Plus, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type Answer = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; role: string };
};

type Question = {
  id: string;
  text: string;
  partOf: string;
  isApproved: boolean;
  isAiGenerated: boolean;
  answers: Answer[];
  milestone: { id: string; order: number; title: string } | null;
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

  const [answering, setAnswering] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showHistory, setShowHistory] = useState<string | null>(null);

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
    await fetch(`/api/projects/${projectId}/questions/${qId}/approve`, {
      method: "PATCH",
    });
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, isApproved: true } : q))
    );
    toast.success("Question approved", { style: TOAST_STYLE });
  }

  async function submitAnswer(qId: string) {
    if (!answerText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/questions/${qId}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: answerText }),
        }
      );
      const data = (await res.json()) as { data?: Answer; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === qId
            ? { ...q, answers: [data.data!, ...q.answers] }
            : q
        )
      );
      setAnswering(null);
      setAnswerText("");
      toast.success("Answer saved", { style: TOAST_STYLE });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", {
        style: TOAST_ERROR_STYLE,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function addQuestion() {
    if (newText.trim().length < 5) {
      toast.error("Question too short (min 5 chars)", { style: TOAST_ERROR_STYLE });
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
      setQuestions((prev) => [...prev, data.data!]);
      setShowAddForm(false);
      setNewText("");
      setNewPartOf("start");
      toast.success(
        data.data!.isApproved ? "Question added" : "Submitted for approval",
        { style: TOAST_STYLE }
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", {
        style: TOAST_ERROR_STYLE,
      });
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const isManager = user
    ? ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(user.role)
    : false;
  const isClient = user?.role === "CLIENT";
  const canAnswer = isManager || isClient;

  // Group questions: "start" or unrecognised → "Needed to Start"; "milestone_N" → milestone group
  const startQuestions = questions.filter(
    (q) => !q.partOf.startsWith("milestone_")
  );
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

  function QuestionCard({ q }: { q: Question }) {
    const latestAnswer = q.answers[0];
    const previousAnswers = q.answers.slice(1);

    return (
      <div
        ref={(el) => {
          questionRefs.current[q.id] = el;
        }}
        className={`p-4 rounded-xl border transition-all ${
          q.isApproved
            ? "bg-base-200 border-base-300"
            : "bg-base-300/50 border-warning/30"
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-sm font-medium text-base-content flex-1">{q.text}</p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!q.isApproved &&
              (isManager ? (
                <button
                  className="btn btn-warning btn-xs"
                  onClick={() => void approveQuestion(q.id)}
                >
                  Approve
                </button>
              ) : (
                <span className="badge badge-warning badge-sm">
                  Pending Approval
                </span>
              ))}
            {q.isAiGenerated && (
              <span className="badge badge-ghost badge-xs gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                AI
              </span>
            )}
          </div>
        </div>

        {q.isApproved && (
          <div className="space-y-2">
            {/* Latest answer */}
            {latestAnswer ? (
              <div className="bg-base-300 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-base-content">
                    {latestAnswer.user.name}
                  </span>
                  <span className="text-xs text-base-content/40">
                    {dayjs(latestAnswer.createdAt).fromNow()}
                  </span>
                </div>
                <p className="text-sm text-base-content/80 whitespace-pre-wrap">
                  {latestAnswer.content}
                </p>
                {previousAnswers.length > 0 && (
                  <button
                    className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                    onClick={() =>
                      setShowHistory(showHistory === q.id ? null : q.id)
                    }
                  >
                    <History className="w-3 h-3" />
                    {showHistory === q.id
                      ? "Hide history"
                      : `${previousAnswers.length} previous response${previousAnswers.length > 1 ? "s" : ""}`}
                  </button>
                )}
                {showHistory === q.id && (
                  <div className="mt-2 space-y-2 pl-3 border-l-2 border-base-content/10">
                    {previousAnswers.map((a) => (
                      <div key={a.id} className="text-xs">
                        <span className="text-base-content/50">
                          {a.user.name} · {dayjs(a.createdAt).fromNow()}
                        </span>
                        <p className="text-base-content/60 mt-0.5">{a.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-base-content/40 italic">No answer yet</p>
            )}

            {/* Answer input */}
            {canAnswer &&
              (answering === q.id ? (
                <div className="space-y-2">
                  <textarea
                    className="textarea textarea-bordered bg-base-100 w-full text-sm"
                    rows={3}
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Type your answer..."
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn btn-primary btn-sm gap-1"
                      onClick={() => void submitAnswer(q.id)}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Save Answer
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setAnswering(null);
                        setAnswerText("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-ghost btn-xs text-primary"
                  onClick={() => {
                    setAnswering(q.id);
                    setAnswerText(latestAnswer?.content ?? "");
                  }}
                >
                  {latestAnswer ? "Update Answer" : "Answer"}
                </button>
              ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes q-pulse {
          0%,100% { box-shadow: 0 0 0 0 hsl(var(--p) / 0.3); }
          50%      { box-shadow: 0 0 0 10px hsl(var(--p) / 0); }
        }
        .question-pulse { animation: q-pulse 0.8s ease-out 3; }
      `}</style>

      <div className="max-w-2xl space-y-6">
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
                <button
                  className="btn btn-ghost btn-xs btn-circle"
                  onClick={() => setShowAddForm(false)}
                >
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
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {!isManager && (
                <p className="text-xs text-base-content/50">
                  Your question will be visible after manager approval.
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void addQuestion()}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Needed to Start section */}
        {startQuestions.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">
              Needed to Start
            </h2>
            {startQuestions.map((q) => (
              <QuestionCard key={q.id} q={q} />
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
                <QuestionCard key={q.id} q={q} />
              ))}
            </div>
          );
        })}

        {questions.length === 0 && (
          <div className="text-center py-16 text-base-content/40">
            <div className="text-5xl mb-3">❓</div>
            <p className="text-lg">No questions yet</p>
            {!isClient && (
              <button
                className="btn btn-primary btn-sm mt-4"
                onClick={() => setShowAddForm(true)}
              >
                Add the first question
              </button>
            )}
          </div>
        )}
      </div>
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

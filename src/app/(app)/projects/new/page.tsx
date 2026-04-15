"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type TeamMember = { id: string; name: string; role: string; profilePicUrl: string | null };
type Client = { id: string; name: string; profilePicUrl: string | null };
type Milestone = { id: string; title: string; content: string };
type Question = { id: string; text: string; partOf: string };

let _milestoneCounter = 0;
function newMilestone(title = "", content = ""): Milestone {
  return { id: `ms-${++_milestoneCounter}`, title, content };
}
function newQuestion(text = "", partOf = ""): Question {
  return { id: `q-${++_milestoneCounter}`, text, partOf };
}

interface BlockTextContent {
  type: "text";
  text: string;
  styles: Record<string, unknown>;
}

interface BlockNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content: BlockTextContent[];
  children: BlockNode[];
}

function createTextContent(text: string): BlockTextContent[] {
  return [{ type: "text", text, styles: {} }];
}

function markdownToBlockJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const lines = trimmed.replace(/\r\n/g, "\n").split("\n");
  const blocks: BlockNode[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const paragraph = paragraphBuffer.join(" ").trim();
    if (paragraph) {
      blocks.push({
        id: `p-${Date.now()}-${blocks.length}`,
        type: "paragraph",
        props: {},
        content: createTextContent(paragraph),
        children: [],
      });
    }
    paragraphBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const level = Math.min(Math.max(headingMatch[1].length, 1), 3);
      blocks.push({
        id: `h-${Date.now()}-${blocks.length}`,
        type: "heading",
        props: { level },
        content: createTextContent(headingMatch[2].trim()),
        children: [],
      });
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      blocks.push({
        id: `b-${Date.now()}-${blocks.length}`,
        type: "bulletListItem",
        props: {},
        content: createTextContent(bulletMatch[1].trim()),
        children: [],
      });
      continue;
    }

    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      blocks.push({
        id: `n-${Date.now()}-${blocks.length}`,
        type: "numberedListItem",
        props: {},
        content: createTextContent(numberedMatch[1].trim()),
        children: [],
      });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();

  if (blocks.length === 0) {
    return JSON.stringify([
      {
        id: `p-${Date.now()}`,
        type: "paragraph",
        props: {},
        content: createTextContent(trimmed),
        children: [],
      },
    ]);
  }

  return JSON.stringify(blocks);
}

const StandaloneEditor = dynamic(
  () => import("@/components/documents/StandaloneEditor"),
  { ssr: false }
);

// ── Sortable milestone row ──────────────────────────────────────────────────
function SortableMilestone({
  milestone,
  onChange,
  onRemove,
}: {
  milestone: Milestone;
  onChange: (id: string, field: "title" | "content", val: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: milestone.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 items-start bg-base-300 rounded-lg p-3">
      <button
        type="button"
        className="mt-1 cursor-grab active:cursor-grabbing text-base-content/30 hover:text-base-content/60 flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 space-y-2">
        <input
          type="text"
          className="input input-bordered input-sm bg-base-100 w-full"
          placeholder="Milestone title"
          value={milestone.title}
          onChange={(e) => onChange(milestone.id, "title", e.target.value)}
          required
        />
        <div className="bg-base-100 border border-base-300 rounded-lg p-2">
          <p className="text-xs text-base-content/50 mb-2">Requirements / Description</p>
          <StandaloneEditor
            initialContent={milestone.content}
            onChange={(json) => onChange(milestone.id, "content", json)}
          />
        </div>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-circle text-error mt-1 flex-shrink-0"
        onClick={() => onRemove(milestone.id)}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Main form ──────────────────────────────────────────────────────────────
function NewProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId");

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Basic info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [requestedById, setRequestedById] = useState("");
  const [price, setPrice] = useState("");
  const [clients, setClients] = useState<Client[]>([]);

  // Step 2 — Milestones
  const [milestones, setMilestones] = useState<Milestone[]>([newMilestone()]);
  const [generatingMilestones, setGeneratingMilestones] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  // Step 3 — Team
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  // Step 4 — Questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load clients + team members
  useEffect(() => {
    Promise.all([
      fetch("/api/users/clients").then((r) => r.json()),
      fetch("/api/users/team-members").then((r) => r.json()),
    ]).then(([cRes, tRes]: [{ data: Client[] }, { data: TeamMember[] }]) => {
      setClients(cRes.data ?? []);
      setTeamMembers(tRes.data ?? []);
    });
  }, []);

  // Prefill from client request
  useEffect(() => {
    if (!requestId) return;
    fetch(`/api/projects/client-requests/${requestId}`)
      .then((r) => r.json())
      .then((d: { data: { title: string; description: string; clientId: string } }) => {
        if (!d.data) return;
        setTitle(d.data.title);
        setDescription(d.data.description);
        setClientId(d.data.clientId);
        setRequestedById(d.data.clientId);
      });
  }, [requestId]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setMilestones((ms) => {
      const from = ms.findIndex((m) => m.id === active.id);
      const to = ms.findIndex((m) => m.id === over.id);
      return arrayMove(ms, from, to);
    });
  }

  function updateMilestone(id: string, field: "title" | "content", val: string) {
    setMilestones((ms) => ms.map((m) => (m.id === id ? { ...m, [field]: val } : m)));
  }

  function removeMilestone(id: string) {
    setMilestones((ms) => ms.filter((m) => m.id !== id));
  }

  async function generateMilestones() {
    if (!title || !description) {
      toast.error("Add a title and description first", { style: TOAST_ERROR_STYLE });
      return;
    }
    setGeneratingMilestones(true);
    try {
      const promptAddition = aiPrompt.trim() ? `\n\nAdditional instructions: ${aiPrompt.trim()}` : "";
      const res = await fetch("/api/ai/generate-milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description + promptAddition }),
      });
      const data = (await res.json()) as { data?: { title: string; content: string }[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const generated = (data.data ?? []).map((m) => newMilestone(m.title, markdownToBlockJson(m.content)));
      setMilestones(generated);
      toast.success("Milestones generated!", { style: TOAST_STYLE });
    } catch {
      toast.error("AI generation failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setGeneratingMilestones(false);
    }
  }

  async function generateQuestions() {
    setGeneratingQuestions(true);
    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          milestones: milestones.map((m) => ({ title: m.title })),
        }),
      });
      const data = (await res.json()) as { data?: { text: string; partOf: string }[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setQuestions((data.data ?? []).map((q) => newQuestion(q.text, q.partOf)));
      toast.success("Questions generated!", { style: TOAST_STYLE });
    } catch {
      toast.error("AI generation failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setGeneratingQuestions(false);
    }
  }

  function toggleMember(id: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateQuestion(id: string, field: "text" | "partOf", val: string) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, [field]: val } : q)));
  }

  function removeQuestion(id: string) {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  }

  function canNext() {
    if (step === 1) return title.trim().length >= 2 && description.trim().length >= 1;
    if (step === 2) return milestones.length > 0 && milestones.every((m) => m.title.trim());
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          clientId: clientId || undefined,
          requestedById: requestedById || undefined,
          requestId: requestId || undefined,
          price: price ? Number(price) : undefined,
          teamMemberIds: Array.from(selectedMemberIds),
          milestones: milestones.map((m, i) => ({ title: m.title, content: m.content, order: i })),
          questions: questions
            .filter((q) => q.text.trim())
            .map((q) => ({ text: q.text, partOf: q.partOf })),
        }),
      });
      const data = (await res.json()) as { data?: { id: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create project");
      toast.success("Project created!", { style: TOAST_STYLE });
      router.push(`/projects/${data.data!.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setSubmitting(false);
    }
  }

  const ROLE_LABELS: Record<string, string> = {
    DEVELOPER: "Developer",
    DESIGNER: "Designer",
    PROJECT_MANAGER: "PM",
    HR: "HR",
    ACCOUNTANT: "Accountant",
    SALES: "Sales",
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button className="btn btn-ghost btn-sm btn-circle" onClick={() => router.push("/projects")}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-base-content">New Project</h1>
          {requestId && (
            <p className="text-sm text-base-content/50 mt-0.5">Prefilled from client request</p>
          )}
        </div>
      </div>

      {/* Step indicator */}
      <ul className="steps w-full text-xs">
        {["Basic Info", "Milestones", "Team", "Review"].map((label, i) => (
          <li key={label} className={`step ${step > i ? "step-primary" : ""}`}>
            {label}
          </li>
        ))}
      </ul>

      {/* ── Step 1: Basic Info ── */}
      {step === 1 && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body space-y-4">
            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text">Project Title *</span></label>
              <input
                type="text"
                className="input input-bordered bg-base-100"
                placeholder="e.g. E-commerce Website Redesign"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                minLength={2}
                maxLength={200}
              />
            </div>

            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text">Description *</span></label>
              <textarea
                className="textarea textarea-bordered bg-base-100 min-h-24"
                placeholder="What does this project involve?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text">Client</span></label>
                <select
                  className="select select-bordered bg-base-100"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">No client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text">Budget</span></label>
                <input
                  type="number"
                  className="input input-bordered bg-base-100"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  min={0}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Milestones ── */}
      {step === 2 && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base-content">Milestones</h3>
                <button
                  type="button"
                  className="btn btn-outline btn-sm gap-2"
                  onClick={() => void generateMilestones()}
                  disabled={generatingMilestones}
                >
                  {generatingMilestones ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  AI Generate
                </button>
              </div>
              <input
                type="text"
                className="input input-bordered input-sm bg-base-100 w-full"
                placeholder="Custom instructions for AI (e.g. 'Include deployment milestone')"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={milestones.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {milestones.map((m) => (
                    <SortableMilestone
                      key={m.id}
                      milestone={m}
                      onChange={updateMilestone}
                      onRemove={removeMilestone}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button
              type="button"
              className="btn btn-ghost btn-sm gap-2 w-full border border-dashed border-base-content/20"
              onClick={() => setMilestones((ms) => [...ms, newMilestone()])}
            >
              <Plus className="w-4 h-4" /> Add Milestone
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Team ── */}
      {step === 3 && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body space-y-4">
            <h3 className="font-semibold text-base-content">
              Select Team Members
              {selectedMemberIds.size > 0 && (
                <span className="ml-2 badge badge-primary badge-sm">{selectedMemberIds.size}</span>
              )}
            </h3>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {teamMembers.map((m) => {
                const selected = selectedMemberIds.has(m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selected ? "bg-primary/10 border border-primary/30" : "bg-base-300 hover:bg-base-300/80"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={selected}
                      onChange={() => toggleMember(m.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-base-content truncate">{m.name}</p>
                      <p className="text-xs text-base-content/50">
                        {ROLE_LABELS[m.role] ?? m.role}
                      </p>
                    </div>
                  </label>
                );
              })}
              {teamMembers.length === 0 && (
                <p className="text-center py-8 text-base-content/40 text-sm">No team members found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Review + Questions ── */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body space-y-2">
              <h3 className="font-semibold text-base-content">Summary</h3>
              <p className="text-sm text-base-content/80">
                <span className="font-medium">Title:</span> {title}
              </p>
              <p className="text-sm text-base-content/80">
                <span className="font-medium">Milestones:</span> {milestones.length}
              </p>
              <p className="text-sm text-base-content/80">
                <span className="font-medium">Team:</span> {selectedMemberIds.size} member
                {selectedMemberIds.size !== 1 ? "s" : ""}
              </p>
              {price && (
                <p className="text-sm text-base-content/80">
                  <span className="font-medium">Budget:</span> ${Number(price).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Questions */}
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base-content">
                  Client Questions{" "}
                  <span className="text-base-content/40 font-normal text-sm">(optional)</span>
                </h3>
                <button
                  type="button"
                  className="btn btn-outline btn-sm gap-2"
                  onClick={() => void generateQuestions()}
                  disabled={generatingQuestions}
                >
                  {generatingQuestions ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  AI Generate
                </button>
              </div>

              <div className="space-y-2">
                {questions.map((q) => (
                  <div key={q.id} className="flex gap-2 items-start bg-base-300 rounded-lg p-3">
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        className="input input-bordered input-sm bg-base-100 w-full"
                        placeholder="Question"
                        value={q.text}
                        onChange={(e) => updateQuestion(q.id, "text", e.target.value)}
                      />
                      <input
                        type="text"
                        className="input input-bordered input-sm bg-base-100 w-full"
                        placeholder="Category (e.g. Design, Scope)"
                        value={q.partOf}
                        onChange={(e) => updateQuestion(q.id, "partOf", e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-circle text-error mt-1 flex-shrink-0"
                      onClick={() => removeQuestion(q.id)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm gap-2 w-full border border-dashed border-base-content/20"
                onClick={() => setQuestions((qs) => [...qs, newQuestion()])}
              >
                <Plus className="w-4 h-4" /> Add Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => (step === 1 ? router.push("/projects") : setStep((s) => s - 1))}
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 1 ? "Cancel" : "Back"}
        </button>

        {step < 4 ? (
          <button
            type="button"
            className="btn btn-primary gap-2"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary gap-2"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting && <span className="loading loading-spinner loading-sm" />}
            Create Project
          </button>
        )}
      </div>
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      }
    >
      <NewProjectForm />
    </Suspense>
  );
}

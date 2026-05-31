"use client";

import { Check, History, Pencil, Sparkles, Trash2, User, X } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

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

type PartOfOption = { value: string; label: string };

function CreatorBadge({ q, isClient }: { q: Question; isClient: boolean }) {
  if (isClient) return null;
  if (q.isAiGenerated) {
    return (
      <span className="badge badge-ghost badge-xs gap-1">
        <Sparkles className="w-2.5 h-2.5" />
        AI
      </span>
    );
  }
  if (q.createdBy) {
    return (
      <span className="badge badge-ghost badge-xs gap-1">
        <User className="w-2.5 h-2.5" />
        {q.createdBy.name}
      </span>
    );
  }
  return null;
}

type QuestionCardProps = {
  q: Question;
  isClient: boolean;
  isManager: boolean;
  currentUserId?: string;
  isEditing: boolean;
  editText: string;
  editPartOf: string;
  editSaving: boolean;
  isAnswering: boolean;
  answerText: string;
  submitting: boolean;
  isHistoryOpen: boolean;
  partOfOptions: PartOfOption[];
  onEditStart: () => void;
  onEditTextChange: (v: string) => void;
  onEditPartOfChange: (v: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDeleteClick: () => void;
  onApprove: () => void;
  onAnswerStart: (latestContent: string) => void;
  onAnswerTextChange: (v: string) => void;
  onAnswerSubmit: () => void;
  onAnswerCancel: () => void;
  onToggleHistory: () => void;
  setRef: (el: HTMLDivElement | null) => void;
};

export function QuestionCard({
  q,
  isClient,
  isManager,
  currentUserId,
  isEditing,
  editText,
  editPartOf,
  editSaving,
  isAnswering,
  answerText,
  submitting,
  isHistoryOpen,
  partOfOptions,
  onEditStart,
  onEditTextChange,
  onEditPartOfChange,
  onEditSave,
  onEditCancel,
  onDeleteClick,
  onApprove,
  onAnswerStart,
  onAnswerTextChange,
  onAnswerSubmit,
  onAnswerCancel,
  onToggleHistory,
  setRef,
}: QuestionCardProps) {
  const latestAnswer = (q.answers ?? [])[0];
  const previousAnswers = (q.answers ?? []).slice(1);
  const canAnswer = isManager || isClient;

  const canEdit = !isClient && (isManager || (!q.isApproved && q.createdBy?.id === currentUserId));
  const canDelete = !isClient && (isManager || (!q.isApproved && q.createdBy?.id === currentUserId));

  return (
    <div
      ref={setRef}
      className={`p-4 rounded-xl border transition-all ${
        q.isApproved ? "bg-base-200 border-base-300" : "bg-base-300/50 border-warning/30"
      }`}
    >
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            className="textarea textarea-bordered bg-base-100 text-sm w-full"
            rows={3}
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            autoFocus
          />
          <select
            className="select select-bordered select-sm bg-base-100 w-full"
            value={editPartOf}
            onChange={(e) => onEditPartOfChange(e.target.value)}
          >
            {partOfOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-ghost btn-sm" onClick={onEditCancel}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={onEditSave}
              disabled={editSaving}
            >
              {editSaving ? <span className="loading loading-spinner loading-xs" /> : <Check className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-medium text-base-content flex-1">{q.text}</p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!q.isApproved &&
                (isManager ? (
                  <button className="btn btn-warning btn-xs" onClick={onApprove}>
                    Approve
                  </button>
                ) : (
                  <span className="badge badge-warning badge-sm">Pending Approval</span>
                ))}
              <CreatorBadge q={q} isClient={isClient} />
              {canEdit && (
                <button
                  className="btn btn-ghost btn-xs btn-circle"
                  title="Edit"
                  onClick={onEditStart}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {canDelete && (
                <button
                  className="btn btn-ghost btn-xs btn-circle text-error"
                  title="Delete"
                  onClick={onDeleteClick}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          {dayjs(q.updatedAt).diff(dayjs(q.createdAt), "minute") > 1 && (
            <div className="mb-2 text-xs text-base-content/40">
              Edited {dayjs(q.updatedAt).fromNow()}
            </div>
          )}
        </div>
      )}

      {!isEditing && q.isApproved && (
        <div className="space-y-2">
          {latestAnswer ? (
            <div className="bg-base-300 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-base-content">{latestAnswer.user.name}</span>
                <span className="text-xs text-base-content/40">{dayjs(latestAnswer.createdAt).fromNow()}</span>
              </div>
              <p className="text-sm text-base-content/80 whitespace-pre-wrap">{latestAnswer.content}</p>
              {previousAnswers.length > 0 && (
                <button
                  className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                  onClick={onToggleHistory}
                >
                  <History className="w-3 h-3" />
                  {isHistoryOpen
                    ? "Hide history"
                    : `${previousAnswers.length} previous response${previousAnswers.length > 1 ? "s" : ""}`}
                </button>
              )}
              {isHistoryOpen && (
                <div className="mt-2 space-y-2 pl-3 border-l-2 border-base-content/10">
                  {previousAnswers.map((a) => (
                    <div key={a.id} className="text-xs">
                      <span className="text-base-content/50">{a.user.name} · {dayjs(a.createdAt).fromNow()}</span>
                      <p className="text-base-content/60 mt-0.5">{a.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-base-content/40 italic">No answer yet</p>
          )}

          {canAnswer &&
            (isAnswering ? (
              <div className="space-y-2">
                <textarea
                  className="textarea textarea-bordered bg-base-100 w-full text-sm"
                  rows={3}
                  value={answerText}
                  onChange={(e) => onAnswerTextChange(e.target.value)}
                  placeholder="Type your answer..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    className="btn btn-primary btn-sm gap-1"
                    onClick={onAnswerSubmit}
                    disabled={submitting}
                  >
                    {submitting ? <span className="loading loading-spinner loading-xs" /> : <Check className="w-3.5 h-3.5" />}
                    Save Answer
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={onAnswerCancel}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="btn btn-ghost btn-xs text-primary"
                onClick={() => onAnswerStart(latestAnswer?.content ?? "")}
              >
                {latestAnswer ? "Update Answer" : "Answer"}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

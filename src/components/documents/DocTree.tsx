"use client";

import { useState } from "react";
import { ChevronRight, FileText, Folder, Lock, Plus, BookOpen, Flag } from "lucide-react";

export type DocItem = {
  id: string;
  title: string;
  docType: string;
  access: "PRIVATE" | "INTERNAL" | "CLIENT_VIEW" | "CLIENT_EDIT";
  milestoneId: string | null;
  parentId: string | null;
  ownerId: string | null;
  createdById: string;
  milestone: { id: string; order: number; title: string } | null;
  isShared?: boolean;
  shareToken?: string | null;
  initialContent?: string | null;
};

type Milestone = { id: string; order: number; title: string };

interface DocTreeProps {
  docs: DocItem[];
  milestones: Milestone[];
  selectedId: string | null;
  currentUserId: string;
  currentUserRole: string;
  onSelect: (doc: DocItem) => void;
  onNewDoc: (opts: { milestoneId?: string; docType: string }) => void;
}

const ACCESS_COLORS: Record<string, string> = {
  PRIVATE: "text-warning",
  INTERNAL: "text-base-content/40",
  CLIENT_VIEW: "text-info",
  CLIENT_EDIT: "text-success",
};

function DocRow({
  doc,
  selected,
  onClick,
  indent = 0,
}: {
  doc: DocItem;
  selected: boolean;
  onClick: () => void;
  indent?: number;
}) {
  const isPrivate = doc.access === "PRIVATE";
  return (
    <button
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-all ml-${indent * 4} ${
        selected
          ? "bg-primary/10 text-primary font-medium"
          : "hover:bg-base-300/50 text-base-content/65"
      }`}
      style={{ paddingLeft: `${0.75 + indent * 1.5}rem` }}
      onClick={onClick}
    >
      {isPrivate ? (
        <Lock className="w-3 h-3 flex-shrink-0 text-warning/60" />
      ) : (
        <FileText className={`w-3 h-3 flex-shrink-0 ${selected ? "text-primary/70" : "text-base-content/20"}`} />
      )}
      <span className="truncate flex-1 text-[12px] leading-tight">{doc.title}</span>
      {doc.access !== "INTERNAL" && doc.access !== "PRIVATE" && (
        <span className={`text-[9px] flex-shrink-0 font-medium px-1 py-0.5 rounded ${selected ? "bg-primary/10" : "bg-base-300/50"} ${ACCESS_COLORS[doc.access]}`}>
          {doc.access === "CLIENT_VIEW" ? "view" : "edit"}
        </span>
      )}
    </button>
  );
}

function MilestoneFolder({
  milestone,
  docs,
  selectedId,
  canAdd,
  onSelect,
  onNewDoc,
}: {
  milestone: Milestone;
  docs: DocItem[];
  selectedId: string | null;
  canAdd: boolean;
  onSelect: (doc: DocItem) => void;
  onNewDoc: (opts: { milestoneId?: string; docType: string }) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-0.5">
      <div className="flex items-center gap-1 group pr-1">
        <button
          className="flex items-center gap-2 flex-1 min-w-0 px-2.5 py-2.5 rounded-lg hover:bg-base-200/80 text-left transition-colors"
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronRight
            className={`w-3 h-3 flex-shrink-0 text-base-content/35 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          />
          <Flag className="w-3.5 h-3.5 flex-shrink-0 text-primary/55" />
          <span className="text-[13px] font-semibold text-base-content/75 truncate">
            M{milestone.order}: {milestone.title}
          </span>
        </button>
        {canAdd && (
          <button
            className="btn btn-ghost btn-xs btn-circle flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Add document"
            onClick={() => onNewDoc({ milestoneId: milestone.id, docType: "milestone_doc" })}
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
      {open && (
        <div className="ml-5 border-l-2 border-primary/10 pl-3 space-y-0">
          {docs.length > 0 ? (
            docs.map((d) => (
              <DocRow
                key={d.id}
                doc={d}
                selected={selectedId === d.id}
                onClick={() => onSelect(d)}
                indent={0}
              />
            ))
          ) : (
            <p className="text-[11px] text-base-content/25 italic px-2 py-2 pl-4">No documents yet</p>
          )}
        </div>
      )}
    </div>
  );
}

export function DocTree({
  docs,
  milestones,
  selectedId,
  currentUserId,
  currentUserRole,
  onSelect,
  onNewDoc,
}: DocTreeProps) {
  const isManager = ["ADMIN", "PROJECT_MANAGER"].includes(currentUserRole);
  const isClient = currentUserRole === "CLIENT";

  const requirementsDoc = docs.find((d) => d.docType === "requirements");
  const milestoneDocs: Record<string, DocItem[]> = {};
  for (const m of milestones) {
    milestoneDocs[m.id] = docs.filter((d) => d.milestoneId === m.id);
  }
  const customDocs = docs.filter(
    (d) => d.docType === "custom" && !d.milestoneId && d.access !== "PRIVATE"
  );
  const privateDocs = docs.filter(
    (d) => d.access === "PRIVATE" && d.ownerId === currentUserId
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-base-300 flex items-center justify-between">
        <span className="text-[11px] font-bold text-base-content/35 uppercase tracking-widest">
          Documents
        </span>
        {!isClient && (
          <button
            className="btn btn-ghost btn-xs btn-circle"
            title="New document"
            onClick={() => onNewDoc({ docType: "custom" })}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Overview */}
        {requirementsDoc && (
          <div>
            <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest px-2.5 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" /> Overview
            </p>
            <DocRow
              doc={requirementsDoc}
              selected={selectedId === requirementsDoc.id}
              onClick={() => onSelect(requirementsDoc)}
            />
          </div>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest px-2.5 mb-1 flex items-center gap-1.5">
              <Flag className="w-3 h-3" /> Milestones
            </p>
            <div className="space-y-2">
              {milestones.map((m) => (
                <MilestoneFolder
                  key={m.id}
                  milestone={m}
                  docs={milestoneDocs[m.id] ?? []}
                  selectedId={selectedId}
                  canAdd={!isClient}
                  onSelect={onSelect}
                  onNewDoc={onNewDoc}
                />
              ))}
            </div>
          </div>
        )}

        {/* Custom docs */}
        {customDocs.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest px-2.5 mb-1 flex items-center gap-1.5">
              <Folder className="w-3 h-3" /> Documents
            </p>
            <div className="space-y-0.5">
              {customDocs.map((d) => (
                <DocRow
                  key={d.id}
                  doc={d}
                  selected={selectedId === d.id}
                  onClick={() => onSelect(d)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Private */}
        {!isClient && privateDocs.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest px-2.5 mb-1 flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Private
            </p>
            <div className="space-y-0.5">
              {privateDocs.map((d) => (
                <DocRow
                  key={d.id}
                  doc={d}
                  selected={selectedId === d.id}
                  onClick={() => onSelect(d)}
                />
              ))}
            </div>
          </div>
        )}

        {docs.length === 0 && (
          <p className="text-center text-sm text-base-content/30 py-8">No documents yet</p>
        )}
      </div>
    </div>
  );
}

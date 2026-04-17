"use client";

import { useState } from "react";
import { ChevronRight, FileText, FolderOpen, Lock, Plus } from "lucide-react";

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
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${
        selected
          ? "bg-primary/15 text-primary"
          : "hover:bg-base-300 text-base-content/80"
      }`}
      style={{ paddingLeft: `${0.5 + indent * 1}rem` }}
      onClick={onClick}
    >
      {isPrivate ? (
        <Lock className={`w-3.5 h-3.5 flex-shrink-0 ${ACCESS_COLORS.PRIVATE}`} />
      ) : (
        <FileText className="w-3.5 h-3.5 flex-shrink-0 text-base-content/40" />
      )}
      <span className="truncate flex-1">{doc.title}</span>
      {doc.access !== "INTERNAL" && (
        <span className={`text-xs flex-shrink-0 ${ACCESS_COLORS[doc.access]}`}>
          {doc.access === "CLIENT_VIEW" ? "view" : doc.access === "CLIENT_EDIT" ? "edit" : ""}
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
    <div>
      <div className="flex items-center gap-1 group">
        <button
          className="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-lg hover:bg-base-300 text-left"
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronRight
            className={`w-3.5 h-3.5 flex-shrink-0 text-base-content/40 transition-transform ${open ? "rotate-90" : ""}`}
          />
          <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-primary/60" />
          <span className="text-sm font-medium text-base-content/70 truncate">
            M{milestone.order}: {milestone.title}
          </span>
        </button>
        {canAdd && (
          <button
            className="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 transition-opacity mr-1"
            title="Add doc to milestone"
            onClick={() => onNewDoc({ milestoneId: milestone.id, docType: "milestone_doc" })}
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
      {open && docs.length > 0 && (
        <div className="ml-2 space-y-0.5">
          {docs.map((d) => (
            <DocRow
              key={d.id}
              doc={d}
              selected={selectedId === d.id}
              onClick={() => onSelect(d)}
              indent={1}
            />
          ))}
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
  const isManager = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(currentUserRole);
  const isClient = currentUserRole === "CLIENT";

  // Requirements doc (always first)
  const requirementsDoc = docs.find((d) => d.docType === "requirements");
  // Milestone docs grouped
  const milestoneDocs: Record<string, DocItem[]> = {};
  for (const m of milestones) {
    milestoneDocs[m.id] = docs.filter((d) => d.milestoneId === m.id);
  }
  // Custom root docs (not requirements, not milestone-linked)
  const customDocs = docs.filter(
    (d) => d.docType === "custom" && !d.milestoneId && d.access !== "PRIVATE"
  );
  // Private docs (current user's own)
  const privateDocs = docs.filter(
    (d) => d.access === "PRIVATE" && d.ownerId === currentUserId
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-base-300 flex items-center justify-between">
        <span className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">
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

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Requirements */}
        {requirementsDoc && (
          <div>
            <p className="text-xs text-base-content/40 px-2 py-1 uppercase tracking-widest font-semibold">
              Overview
            </p>
            <DocRow
              doc={requirementsDoc}
              selected={selectedId === requirementsDoc.id}
              onClick={() => onSelect(requirementsDoc)}
            />
          </div>
        )}

        {/* Milestone folders */}
        {milestones.length > 0 && (
          <div className="space-y-0.5 mt-2">
            <p className="text-xs text-base-content/40 px-2 py-1 uppercase tracking-widest font-semibold">
              Milestones
            </p>
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
        )}

        {/* Custom docs */}
        {customDocs.length > 0 && (
          <div className="space-y-0.5 mt-2">
            <p className="text-xs text-base-content/40 px-2 py-1 uppercase tracking-widest font-semibold">
              Documents
            </p>
            {customDocs.map((d) => (
              <DocRow
                key={d.id}
                doc={d}
                selected={selectedId === d.id}
                onClick={() => onSelect(d)}
              />
            ))}
          </div>
        )}

        {/* Private docs */}
        {!isClient && privateDocs.length > 0 && (
          <div className="space-y-0.5 mt-2">
            <p className="text-xs text-base-content/40 px-2 py-1 uppercase tracking-widest font-semibold flex items-center gap-1">
              <Lock className="w-3 h-3" /> Private
            </p>
            {privateDocs.map((d) => (
              <DocRow
                key={d.id}
                doc={d}
                selected={selectedId === d.id}
                onClick={() => onSelect(d)}
              />
            ))}
          </div>
        )}

        {docs.length === 0 && (
          <p className="text-center text-sm text-base-content/40 py-8">No documents</p>
        )}
      </div>
    </div>
  );
}

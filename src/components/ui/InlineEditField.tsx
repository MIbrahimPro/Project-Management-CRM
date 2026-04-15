"use client";

import { Check, Pencil, X } from "lucide-react";

interface Props {
  value: string;
  editingValue: string;
  isEditing: boolean;
  isSaving: boolean;
  error: string | null;
  placeholder?: string;
  inputType?: "text" | "tel";
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (v: string) => void;
  displayClassName?: string;
}

export function InlineEditField({
  value,
  editingValue,
  isEditing,
  isSaving,
  error,
  placeholder,
  inputType = "text",
  onStartEdit,
  onCancel,
  onSave,
  onChange,
  displayClassName,
}: Props) {
  if (isEditing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <input
            type={inputType}
            className="input input-bordered input-sm flex-1 bg-base-100"
            value={editingValue}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") onCancel();
            }}
            placeholder={placeholder}
            autoFocus
          />
          <button
            className="btn btn-ghost btn-xs btn-circle text-success"
            onClick={onSave}
            disabled={isSaving}
            aria-label="Save"
          >
            {isSaving ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            className="btn btn-ghost btn-xs btn-circle text-error"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {error && <p className="text-error text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-2 cursor-pointer ${displayClassName ?? ""}`}
      onClick={onStartEdit}
    >
      <span className="text-base-content">
        {value || (
          <span className="text-base-content/40 italic">{placeholder ?? "Not set"}</span>
        )}
      </span>
      <Pencil className="w-3.5 h-3.5 text-base-content/0 group-hover:text-base-content/40 transition-colors flex-shrink-0" />
    </div>
  );
}

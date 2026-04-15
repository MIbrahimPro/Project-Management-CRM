"use client";

import { useState } from "react";

/**
 * Generic inline edit state manager.
 * saveFn returns { error? } — throw is never used; errors surface via return value.
 */
export function useInlineEdit<T>(
  initialValue: T,
  saveFn: (value: T) => Promise<{ error?: string }>
) {
  const [value, setValue] = useState<T>(initialValue);
  const [editingValue, setEditingValue] = useState<T>(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setEditingValue(value);
    setIsEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setError(null);
  };

  const saveEdit = async () => {
    if (editingValue === value) {
      cancelEdit();
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await saveFn(editingValue);
      if (result?.error) {
        setError(result.error);
      } else {
        setValue(editingValue);
        setIsEditing(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  /** Sync displayed value with an external update (e.g. after parent state change). */
  const syncValue = (v: T) => {
    setValue(v);
    setEditingValue(v);
  };

  return {
    value,
    editingValue,
    setEditingValue,
    isEditing,
    isSaving,
    error,
    startEdit,
    cancelEdit,
    saveEdit,
    syncValue,
  };
}

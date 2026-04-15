"use client";

import { forwardRef, useImperativeHandle, useEffect, useRef } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@/styles/blocknote-overrides.css";
import { useTheme } from "@/components/providers/ThemeProvider";
import type { Block } from "@blocknote/core";

const LIGHT_THEMES = ["neutral-light", "light", "corporate", "pale"];

interface StandaloneEditorProps {
  initialContent?: string;
  readOnly?: boolean;
  minHeight?: string;
  onChange?: (json: string) => void;
}

export interface StandaloneEditorHandle {
  getContent: () => string;
}

/**
 * Parse a stored BlockNote JSON string into an array of Blocks.
 * Returns undefined for empty/invalid input so the editor creates a default empty paragraph.
 */
function tryParseBlocks(raw: string): Block[] | undefined {
  if (!raw || raw.trim() === "") return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as Block[];
    return undefined;
  } catch {
    return [
      {
        id: "plain-" + Date.now(),
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: raw, styles: {} }],
        children: [],
      } as unknown as Block,
    ];
  }
}

const StandaloneEditor = forwardRef<StandaloneEditorHandle, StandaloneEditorProps>(
  function StandaloneEditor({ initialContent = "", readOnly = false, onChange }, ref) {
    const { theme } = useTheme();
    const bnTheme = LIGHT_THEMES.includes(theme) ? "light" : "dark";

    const editor = useCreateBlockNote({
      initialContent: tryParseBlocks(initialContent),
      uploadFile: async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", file.type.startsWith("image/") ? "image" : "document");
        const res = await fetch("/api/chat/upload", { method: "POST", body: formData });
        const data = (await res.json()) as { data?: { path: string } };
        if (!data.data?.path) throw new Error("Upload failed");
        const signedRes = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(data.data.path)}`);
        const signedData = (await signedRes.json()) as { url?: string };
        return signedData.url ?? "";
      },
    });

    const serialise = () => {
      try {
        return JSON.stringify(editor.document);
      } catch {
        return "[]";
      }
    };

    useImperativeHandle(ref, () => ({
      getContent: serialise,
    }));

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
      if (!onChangeRef.current) return;
      const unsub = editor.onChange(() => {
        onChangeRef.current?.(serialise());
      });
      return () => {
        if (typeof unsub === "function") unsub();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor]);

    return (
      <div className="bn-editor-wrapper">
        <BlockNoteView
          editor={editor}
          editable={!readOnly}
          theme={bnTheme}
          className="bn-standalone min-h-[160px]"
        />
      </div>
    );
  },
);

export default StandaloneEditor;

"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
  FormattingToolbar,
  FormattingToolbarController,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { filterSuggestionItems } from "@blocknote/core";
import { Sparkles } from "lucide-react";
import "@blocknote/mantine/style.css";
import "@/styles/blocknote-overrides.css";
import { useTheme } from "@/components/providers/ThemeProvider";

const LIGHT_THEMES = ["neutral-light", "light", "corporate", "pale"];

/** Hash a string to a deterministic hue (0-360). */
function hashToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

interface DocumentEditorProps {
  docId: string;
  projectId: string;
  collabToken: string;
  currentUser: { id: string; name: string };
  readOnly?: boolean;
  initialContent?: string | null;
}

export default function DocumentEditor({
  docId,
  projectId,
  collabToken,
  currentUser,
  readOnly = false,
  initialContent,
}: DocumentEditorProps) {
  const [synced, setSynced] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectionBusy, setSelectionBusy] = useState<null | "summarize" | "professionalize">(null);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { theme } = useTheme();
  const bnTheme = LIGHT_THEMES.includes(theme) ? "light" : "dark";

  const provider = useMemo(
    () =>
      new HocuspocusProvider({
        url: process.env.NEXT_PUBLIC_HOCUSPOCUS_WS ?? "ws://localhost:3001",
        name: `project-${projectId}-doc-${docId}`,
        token: collabToken,
        onSynced: () => setSynced(true),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docId, projectId],
  );

  useEffect(() => {
    return () => {
      provider.destroy();
    };
  }, [provider]);

  const userColor = hashToColor(currentUser.id);

  const editor = useCreateBlockNote({
    collaboration: {
      provider,
      fragment: provider.document.getXmlFragment("document-store"),
      user: {
        name: currentUser.name,
        color: userColor,
      },
    },
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

  const getEditorPlainText = useCallback(() => {
    if (!wrapperRef.current) return "";
    const el = wrapperRef.current.querySelector(".bn-editor");
    return (el?.textContent ?? "").trim();
  }, []);

  const applySelectionResult = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      // insertInlineContent replaces active selection when one exists.
      editor.insertInlineContent(text);
    },
    [editor]
  );

  const runSelectionAiAction = useCallback(
    async (type: "summarize" | "professionalize") => {
      const source = selectedText.trim();
      if (!source || readOnly) return;
      setSelectionBusy(type);
      try {
        const instruction =
          type === "summarize"
            ? "Summarize this text while preserving key facts and intent."
            : "Professionalize this text for a client-facing software agency document.";
        const res = await fetch("/api/ai/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: type === "summarize" ? "summarize" : "improve",
            prompt: `${instruction}\n\nSelected text:\n${source}`,
            context: `Current document context:\n${getEditorPlainText().slice(0, 7000)}`,
          }),
        });
        const data = (await res.json()) as { data?: { content?: string } };
        const output = data.data?.content?.trim() ?? "";
        if (output) {
          applySelectionResult(output);
          setSelectedText("");
        }
      } finally {
        setSelectionBusy(null);
      }
    },
    [applySelectionResult, getEditorPlainText, readOnly, selectedText]
  );

  const runPromptAiInsert = useCallback(async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || readOnly) return;
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "draft",
          prompt: `Write content to insert into the current document.\nUser request: ${prompt}`,
          context: `Current document context:\n${getEditorPlainText().slice(0, 7000)}`,
        }),
      });
      const data = (await res.json()) as { data?: { content?: string } };
      const output = data.data?.content?.trim() ?? "";
      if (output) editor.insertInlineContent(`\n${output}\n`);
      setAiPromptOpen(false);
      setAiPrompt("");
    } finally {
      setAiBusy(false);
    }
  }, [aiPrompt, editor, getEditorPlainText, readOnly]);

  useEffect(() => {
    return editor.onSelectionChange(() => {
      const next = editor.getSelectedText().trim();
      setSelectedText(next);
    });
  }, [editor]);

  useEffect(() => {
    if (synced && editor && initialContent && !readOnly) {
      // Small delay to ensure Yjs sync is fully settled
      const timer = setTimeout(async () => {
        const isDocEmpty = editor.topLevelBlocks.length === 0 || 
                          (editor.topLevelBlocks.length === 1 && 
                           (!editor.topLevelBlocks[0].content || (Array.isArray(editor.topLevelBlocks[0].content) && editor.topLevelBlocks[0].content.length === 0)));
        
        if (isDocEmpty) {
          try {
            const blocks = await editor.tryParseMarkdownToBlocks(initialContent);
            editor.replaceBlocks(editor.topLevelBlocks, blocks);
          } catch (err) {
            console.error("[BlockNote] Failed to initialize with markdown:", err);
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [synced, editor, initialContent, readOnly]);

  useEffect(() => {
    function handleCopy(event: ClipboardEvent) {
      const selection = window.getSelection();
      const copied = selection?.toString() ?? "";
      if (!copied.trim()) return;
      const anchorNode = selection?.anchorNode;
      if (!anchorNode || !wrapperRef.current?.contains(anchorNode)) return;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", copied);
    }

    document.addEventListener("copy", handleCopy);
    return () => document.removeEventListener("copy", handleCopy);
  }, []);

  const slashItems = useCallback(
    async (query: string): Promise<DefaultReactSuggestionItem[]> => {
      const defaults = getDefaultReactSlashMenuItems(editor);
      const aiItem: DefaultReactSuggestionItem = {
        title: "AI: Write with prompt",
        subtext: "Generate and insert content using AI",
        onItemClick: () => {
          setAiPromptOpen(true);
        },
        aliases: ["ai", "assistant", "generate", "write"],
        group: "AI",
      };
      return filterSuggestionItems([...defaults, aiItem], query);
    },
    [editor]
  );

  if (!synced) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  return (
    <div className="bn-editor-wrapper h-full relative" ref={wrapperRef}>
      <BlockNoteView
        editor={editor}
        editable={!readOnly}
        theme={bnTheme}
        className="h-full"
        slashMenu={false}
        formattingToolbar={false}
      >
        <SuggestionMenuController triggerCharacter="/" getItems={slashItems} />
        <FormattingToolbarController
          formattingToolbar={(props) => (
            <FormattingToolbar {...props}>
              <div className="flex items-center gap-1 border-l border-base-300 ml-1 pl-1">
                <button
                  className="bn-button hover:bg-base-300 transition-colors"
                  onClick={() => void runSelectionAiAction("summarize")}
                  title="AI Summarize"
                  disabled={selectionBusy !== null}
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] ml-1">Summarize</span>
                </button>
                <button
                  className="bn-button hover:bg-base-300 transition-colors"
                  onClick={() => void runSelectionAiAction("professionalize")}
                  title="AI Professionalize"
                  disabled={selectionBusy !== null}
                >
                  <Sparkles className="w-3.5 h-3.5 text-secondary" />
                  <span className="text-[10px] ml-1">Fix</span>
                </button>
              </div>
            </FormattingToolbar>
          )}
        />
      </BlockNoteView>


      <dialog className={`modal ${aiPromptOpen ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-lg">
          <h3 className="font-semibold text-base-content text-lg mb-2">AI Insert</h3>
          <p className="text-sm text-base-content/60 mb-3">
            Describe what to write. Generated content will be inserted at the cursor.
          </p>
          <textarea
            className="textarea textarea-bordered bg-base-100 w-full min-h-28"
            placeholder="e.g. Write a structured API requirements section for milestone 2..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />
          <div className="modal-action">
            <button
              className="btn btn-ghost"
              onClick={() => {
                setAiPromptOpen(false);
                setAiPrompt("");
              }}
            >
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => void runPromptAiInsert()} disabled={aiBusy || !aiPrompt.trim()}>
              {aiBusy && <span className="loading loading-spinner loading-xs" />}
              Insert
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setAiPromptOpen(false)} />
      </dialog>
    </div>
  );
}

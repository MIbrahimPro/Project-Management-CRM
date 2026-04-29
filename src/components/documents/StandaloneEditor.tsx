"use client";

import { forwardRef, useImperativeHandle, useEffect, useRef, useState, useCallback } from "react";
import {
  useCreateBlockNote,
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { SuggestionMenuControllerSolid } from "@/components/blocknote/SuggestionMenuControllerSolid";
import { filterSuggestionItems } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@/styles/blocknote-overrides.css";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Sparkles } from "lucide-react";
import type { Block } from "@blocknote/core";

const LIGHT_THEMES = ["neutral-light", "light", "corporate", "pale"];
const MAX_AI_CHARS = 16000; // Groq models support 128K tokens

interface StandaloneEditorProps {
  initialContent?: string;
  readOnly?: boolean;
  minHeight?: string;
  onChange?: (json: string) => void;
}

export interface StandaloneEditorHandle {
  getContent: () => string;
}

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

    const [selectedText, setSelectedText] = useState("");
    const [selectionBusy, setSelectionBusy] = useState<null | "professionalize">(null);
    const [aiPromptOpen, setAiPromptOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiBusy, setAiBusy] = useState(false);
    const wrapperRef = useRef<HTMLDivElement | null>(null);

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

    useEffect(() => {
      return editor.onSelectionChange(() => {
        setSelectedText(editor.getSelectedText().trim());
      });
    }, [editor]);

    const getEditorPlainText = useCallback(() => {
      if (!wrapperRef.current) return "";
      const el = wrapperRef.current.querySelector(".bn-editor");
      return (el?.textContent ?? "").trim();
    }, []);

    const runFixSelection = useCallback(async () => {
      const source = selectedText.trim();
      if (!source || readOnly) return;
      setSelectionBusy("professionalize");
      try {
        // Use full text up to MAX_AI_CHARS (16K is plenty for Groq models)
        const maxSourceLen = MAX_AI_CHARS - 500; // Leave room for instruction
        const truncatedSource = source.length > maxSourceLen ? source.slice(0, maxSourceLen) + "..." : source;
        const res = await fetch("/api/ai/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "improve",
            prompt: `Professionalize this text for a workplace document:\n\n${truncatedSource}`,
            context: `Document context:\n${getEditorPlainText().slice(0, 8000)}`,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err.error || `Request failed: ${res.status}`);
        }
        const data = (await res.json()) as { data?: { content?: string } };
        const output = data.data?.content?.trim() ?? "";
        if (output) {
          // Parse markdown to blocks for proper formatting
          const blocks = await editor.tryParseMarkdownToBlocks(output);
          if (blocks.length > 0) {
            editor.insertBlocks(blocks, editor.getTextCursorPosition().block, "after");
          } else {
            editor.insertInlineContent(output);
          }
        }
      } catch (e) {
        console.error("AI professionalize failed:", e);
      } finally {
        setSelectionBusy(null);
      }
    }, [editor, getEditorPlainText, readOnly, selectedText]);

    const runAiInsert = useCallback(async () => {
      const prompt = aiPrompt.trim();
      if (!prompt || readOnly) return;
      setAiBusy(true);
      try {
        const res = await fetch("/api/ai/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "draft",
            prompt: `Write content to insert into the document.\nUser request: ${prompt}`,
            context: `Document context:\n${getEditorPlainText().slice(0, 5000)}`,
          }),
        });
        const data = (await res.json()) as { data?: { content?: string } };
        const output = data.data?.content?.trim() ?? "";
        if (output) {
          const blocks = await editor.tryParseMarkdownToBlocks(output);
          const cursorBlock = editor.getTextCursorPosition().block;
          editor.insertBlocks(blocks, cursorBlock, "after");
        }
        setAiPromptOpen(false);
        setAiPrompt("");
      } finally {
        setAiBusy(false);
      }
    }, [aiPrompt, editor, getEditorPlainText, readOnly]);

    const slashItems = useCallback(
      async (query: string): Promise<DefaultReactSuggestionItem[]> => {
        const defaults = getDefaultReactSlashMenuItems(editor).filter((item) => {
          const haystack = [
            item.title,
            item.subtext,
            ...(item.aliases ?? []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          // Emoji slash command is intentionally disabled for now.
          return !/(emoji|emoticon|smile|smiley)/.test(haystack);
        });
        const aiItem: DefaultReactSuggestionItem = {
          title: "AI: Write with prompt",
          subtext: "Generate and insert content using AI",
          icon: <Sparkles className="w-4 h-4" />,
          onItemClick: () => setAiPromptOpen(true),
          aliases: ["ai", "generate", "write"],
          group: "AI",
        };
        return filterSuggestionItems([...defaults, aiItem], query);
      },
      [editor]
    );

    return (
      <div className="bn-editor-wrapper flex flex-col" ref={wrapperRef}>
        {/* AI toolbar strip - only show Professionalize when text is selected */}
        {!readOnly && (
          <div className="flex items-center gap-1 px-2 py-1 bg-base-200/60 border-b border-base-300 flex-shrink-0">
            <span className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wide mr-1">AI</span>
            {selectedText && (
              <>
                <button
                  className="btn btn-ghost btn-xs gap-1 text-secondary disabled:text-base-content/30"
                  onClick={() => void runFixSelection()}
                  disabled={selectionBusy !== null || selectedText.length > MAX_AI_CHARS}
                  title={
                    selectedText.length > MAX_AI_CHARS
                      ? `Selection too long (${selectedText.length}/${MAX_AI_CHARS} chars). Select less text.`
                      : "Professionalize selected text"
                  }
                >
                  {selectionBusy === "professionalize" ? <span className="loading loading-spinner loading-xs" /> : <Sparkles className="w-3 h-3" />}
                  Professionalize
                </button>
                <span className={`text-[10px] ml-1 truncate max-w-[120px] ${selectedText.length > MAX_AI_CHARS ? "text-error" : "text-base-content/30"}`}>
                  ({selectedText.length}/{MAX_AI_CHARS})
                </span>
                <div className="w-px h-3 bg-base-300 mx-0.5" />
              </>
            )}
            <button
              className="btn btn-ghost btn-xs gap-1 text-primary"
              onClick={() => setAiPromptOpen(true)}
              title="Write with AI"
            >
              <Sparkles className="w-3 h-3" />
              Write…
            </button>
          </div>
        )}

        <BlockNoteView
          editor={editor}
          editable={!readOnly}
          theme={bnTheme}
          className="bn-standalone min-h-[160px]"
          slashMenu={false}
          formattingToolbar={false}
        >
          <SuggestionMenuControllerSolid triggerCharacter="/" getItems={slashItems} />
          <FormattingToolbarController
            formattingToolbar={(props) => (
              <FormattingToolbar {...props}>
                <div className="flex items-center gap-1 border-l border-base-300 ml-1 pl-1">
                  <button
                    className="bn-button hover:bg-base-300 transition-colors"
                    onClick={() => void runFixSelection()}
                    title="AI Professionalize"
                    disabled={selectionBusy !== null || !selectedText}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-secondary" />
                    <span className="text-[10px] ml-1">Professionalize</span>
                  </button>
                </div>
              </FormattingToolbar>
            )}
          />
        </BlockNoteView>

        {/* AI write modal */}
        <dialog className={`modal ${aiPromptOpen ? "modal-open" : ""}`}>
          <div className="modal-box bg-base-200 max-w-lg">
            <h3 className="font-semibold text-base-content text-lg mb-2">AI Write</h3>
            <p className="text-sm text-base-content/60 mb-3">
              Describe what to write. Generated content will be inserted at the cursor.
            </p>
            <textarea
              className="textarea textarea-bordered bg-base-100 w-full min-h-24"
              placeholder="e.g. Write a summary of the task requirements..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void runAiInsert();
              }}
              autoFocus
            />
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setAiPromptOpen(false); setAiPrompt(""); }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => void runAiInsert()} disabled={aiBusy || !aiPrompt.trim()}>
                {aiBusy && <span className="loading loading-spinner loading-xs" />}
                Insert
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setAiPromptOpen(false)} />
        </dialog>
      </div>
    );
  },
);

export default StandaloneEditor;

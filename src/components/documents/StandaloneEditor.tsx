"use client";

import { forwardRef, useImperativeHandle, useEffect, useRef, useState, useCallback } from "react";
import {
  useCreateBlockNote,
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { SuggestionMenuControllerSolid } from "@/components/blocknote/SuggestionMenuControllerSolid";
import { filterSuggestionItems } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@/styles/blocknote-overrides.css";
import { useTheme } from "@/components/providers/ThemeProvider";
import { SHOW_AI_FEATURES } from "@/config/features";
import { Sparkles } from "lucide-react";
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

function tryParseBlocks(raw: string): Block[] | undefined {
  if (!raw || raw.trim() === "") return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as Block[];
    return undefined;
  } catch {
    return undefined;
  }
}

const StandaloneEditor = forwardRef<StandaloneEditorHandle, StandaloneEditorProps>(
  function StandaloneEditor({ initialContent = "", readOnly = false, onChange }, ref) {
    const { theme } = useTheme();
    const bnTheme = LIGHT_THEMES.includes(theme) ? "light" : "dark";

    const [selectedText, setSelectedText] = useState("");
    const [selectionBusy, setSelectionBusy] = useState<null | "format">(null);
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
    }, [editor]);

    // Handle markdown initialContent
    useEffect(() => {
      if (!initialContent || initialContent.trim() === "" || readOnly) return;
      const blocks = tryParseBlocks(initialContent);
      if (blocks) return;
      const timer = setTimeout(async () => {
        try {
          const mdBlocks = await editor.tryParseMarkdownToBlocks(initialContent.trim());
          if (mdBlocks.length > 0) {
            editor.replaceBlocks(editor.topLevelBlocks, mdBlocks);
          }
        } catch (err) {
          console.error("[StandaloneEditor] Markdown parse failed:", err);
        }
      }, 100);
      return () => clearTimeout(timer);
    }, [editor, initialContent, readOnly]);

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

    const applyBlocks = useCallback(
      async (text: string) => {
        if (!text.trim()) return;
        const blocks = await editor.tryParseMarkdownToBlocks(text);
        if (blocks.length > 0) {
          const selection = editor.getSelection();
          if (selection?.blocks?.length) {
            editor.replaceBlocks(selection.blocks, blocks);
          } else {
            editor.insertBlocks(blocks, editor.getTextCursorPosition().block, "after");
          }
          editor.setTextCursorPosition(blocks[blocks.length - 1], "end");
        } else {
          editor.insertInlineContent(text);
        }
      },
      [editor],
    );

    const runFormat = useCallback(async () => {
      const source = selectedText.trim();
      if (!source || readOnly) return;
      setSelectionBusy("format");
      try {
        const res = await fetch("/api/ai/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "format",
            prompt: `Reformat ONLY the following selected text with proper markdown structure. Do NOT include any other content, only the reformatted version of this text:\n\n${source.slice(0, 15000)}`,
          }),
        });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as { data?: { content?: string } };
        const output = data.data?.content?.trim() ?? "";
        if (output) {
          await applyBlocks(output);
          setSelectedText("");
        }
      } catch (e) {
        console.error("Format failed:", e);
      } finally {
        setSelectionBusy(null);
      }
    }, [applyBlocks, getEditorPlainText, readOnly, selectedText]);

    const runWrite = useCallback(async () => {
      const prompt = aiPrompt.trim();
      if (!prompt || readOnly) return;
      setAiBusy(true);
      try {
        const hasSelection = selectedText.length > 0;
        const userMessage = hasSelection
          ? `Rewrite the selected text based on: ${prompt}\n\nSelected text:\n${selectedText.slice(0, 15000)}`
          : `Write content based on: ${prompt}`;
        const res = await fetch("/api/ai/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "draft",
            prompt: userMessage,
            context: getEditorPlainText().slice(0, 5000),
          }),
        });
        const data = (await res.json()) as { data?: { content?: string } };
        const output = data.data?.content?.trim() ?? "";
        if (output) {
          await applyBlocks(output);
          setSelectedText("");
        }
        setAiPromptOpen(false);
        setAiPrompt("");
      } finally {
        setAiBusy(false);
      }
    }, [aiPrompt, applyBlocks, getEditorPlainText, readOnly, selectedText]);

    const slashItems = useCallback(
      async (query: string): Promise<DefaultReactSuggestionItem[]> => {
        const defaults = getDefaultReactSlashMenuItems(editor).filter((item) => {
          const haystack = [item.title, ...(item.aliases ?? [])]
            .filter(Boolean).join(" ").toLowerCase();
          return !/(emoji|emoticon)/.test(haystack);
        });
        const writeItem: DefaultReactSuggestionItem = {
          title: "Write with AI",
          subtext: "Generate content with AI at the cursor",
          icon: <Sparkles className="w-4 h-4" />,
          onItemClick: () => setAiPromptOpen(true),
          aliases: ["ai", "generate", "write"],
          group: "AI",
        };
        return filterSuggestionItems(SHOW_AI_FEATURES ? [...defaults, writeItem] : defaults, query);
      },
      [editor],
    );

    return (
      <div className="bn-editor-wrapper flex flex-col" ref={wrapperRef}>
        <BlockNoteView
          editor={editor}
          editable={!readOnly}
          theme={bnTheme}
          className="bn-standalone min-h-[160px]"
          slashMenu={false}
          formattingToolbar={false}
        >
          <SuggestionMenuControllerSolid triggerCharacter="/" getItems={slashItems} />
          {!readOnly && (
            <FormattingToolbarController
              formattingToolbar={(props: any) => {
                const defaultItems = getFormattingToolbarItems(props.blockTypeSelectItems);
                const hasTextSelection = SHOW_AI_FEATURES && selectedText.length > 0;
                return (
                  <FormattingToolbar>
                    {defaultItems}
                    {hasTextSelection && (
                      <>
                        <div className="w-px h-5 bg-base-content/15 mx-0.5" />
                        <button
                          className="bn-button"
                          onClick={() => void runFormat()}
                          title="Format selected text"
                          disabled={selectionBusy !== null}
                        >
                          {selectionBusy === "format" ? (
                            <span className="loading loading-spinner w-3.5 h-3.5" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </>
                    )}
                    {SHOW_AI_FEATURES && (
                      <>
                        <div className="w-px h-5 bg-base-content/15 mx-0.5" />
                        <button
                          className="bn-button"
                          onClick={() => setAiPromptOpen(true)}
                          title="Write with AI"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </FormattingToolbar>
                );
              }}
            />
          )}
        </BlockNoteView>

        <dialog className={`modal ${SHOW_AI_FEATURES && aiPromptOpen ? "modal-open" : ""}`}>
          <div className="modal-box bg-base-200 max-w-lg">
            <h3 className="font-semibold text-base-content text-lg mb-2">AI Write</h3>
            <p className="text-sm text-base-content/60 mb-3">
              {selectedText
                ? "Describe how to rewrite the selected text."
                : "Describe what to write."}
            </p>
            <textarea
              className="textarea textarea-bordered bg-base-100 w-full min-h-24"
              placeholder="e.g. Write a summary of the task requirements..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              autoFocus
            />
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setAiPromptOpen(false); setAiPrompt(""); }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void runWrite()}
                disabled={aiBusy || !aiPrompt.trim()}
              >
                {aiBusy && <span className="loading loading-spinner loading-xs" />}
                {selectedText ? "Rewrite" : "Write"}
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

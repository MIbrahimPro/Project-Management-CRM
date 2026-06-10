"use client";

import { forwardRef, useEffect, useMemo, useState, useCallback, useRef, useImperativeHandle } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import {
  useCreateBlockNote,
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
  FormattingToolbar,
  FormattingToolbarController,
  getFormattingToolbarItems,
} from "@blocknote/react";
import { SuggestionMenuControllerSolid } from "@/components/blocknote/SuggestionMenuControllerSolid";
import { BlockNoteView } from "@blocknote/mantine";
import { filterSuggestionItems } from "@blocknote/core";
import { Sparkles, Wand2 } from "lucide-react";
import "@blocknote/mantine/style.css";
import "@/styles/blocknote-overrides.css";
import { useTheme } from "@/components/providers/ThemeProvider";
import { SHOW_AI_FEATURES } from "@/config/features";

const LIGHT_THEMES = ["neutral-light", "light", "corporate", "pale"];
const MAX_AI_CHARS = 16000;

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

export interface DocumentEditorHandle {
  getMarkdown: () => Promise<string>;
}

const DocumentEditor = forwardRef<DocumentEditorHandle, DocumentEditorProps>(function DocumentEditor({
  docId,
  projectId,
  collabToken,
  currentUser,
  readOnly = false,
  initialContent,
}: DocumentEditorProps, ref) {
  const [synced, setSynced] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectionBusy, setSelectionBusy] = useState<null | "format" | "write">(null);
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

  useImperativeHandle(ref, () => ({
    getMarkdown: () => editor.blocksToMarkdownLossy(editor.document),
  }), [editor]);

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
          const cursorBlock = editor.getTextCursorPosition().block;
          editor.insertBlocks(blocks, cursorBlock, "after");
        }
        editor.setTextCursorPosition(blocks[blocks.length - 1], "end");
      } else {
        editor.insertInlineContent(text);
      }
    },
    [editor],
  );

  const runFormatSelection = useCallback(async () => {
    const source = selectedText.trim();
    if (!source || readOnly) return;
    setSelectionBusy("format");
    try {
      const maxLen = MAX_AI_CHARS - 500;
      const truncated = source.length > maxLen ? source.slice(0, maxLen) + "..." : source;
      const res = await fetch("/api/ai/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "format",
          prompt: `Reformat ONLY the following selected text with proper markdown structure. Do NOT include any other content, only the reformatted version of this text:\n\n${truncated}`,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Failed" }))).error);
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
  }, [applyBlocks, readOnly, selectedText]);

  const runWriteAi = useCallback(async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || readOnly) return;
    setAiBusy(true);
    try {
      const hasSelection = selectedText.trim().length > 0;
      const userMessage = hasSelection
        ? `Rewrite the selected text based on: ${prompt}\n\nSelected text:\n${selectedText.slice(0, MAX_AI_CHARS - 500)}`
        : `Write content based on: ${prompt}`;
      const res = await fetch("/api/ai/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "draft",
          prompt: userMessage,
          context: getEditorPlainText().slice(0, 7000),
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

  useEffect(() => {
    return editor.onSelectionChange(() => {
      const text = editor.getSelectedText().trim();
      setSelectedText(text);
    });
  }, [editor]);

  useEffect(() => {
    if (synced && editor && initialContent && !readOnly) {
      const timer = setTimeout(async () => {
        const isDocEmpty =
          editor.topLevelBlocks.length === 0 ||
          (editor.topLevelBlocks.length === 1 &&
            (!editor.topLevelBlocks[0].content ||
              (Array.isArray(editor.topLevelBlocks[0].content) &&
                editor.topLevelBlocks[0].content.length === 0)));
        if (isDocEmpty) {
          try {
            const trimmed = initialContent.trim();
            if (trimmed.startsWith("[{") || trimmed.startsWith("[  {")) {
              const blocks = JSON.parse(trimmed) as Parameters<typeof editor.replaceBlocks>[1];
              editor.replaceBlocks(editor.topLevelBlocks, blocks);
            } else {
              const blocks = await editor.tryParseMarkdownToBlocks(trimmed);
              editor.replaceBlocks(editor.topLevelBlocks, blocks);
            }
          } catch (err) {
            console.error("[BlockNote] Failed to initialize content:", err);
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [synced, editor, initialContent, readOnly]);

  useEffect(() => {
    function handleCopy(event: ClipboardEvent) {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const anchorNode = selection.anchorNode;
      if (!anchorNode || !wrapperRef.current?.contains(anchorNode)) return;
      const copied = selection.toString();
      if (!copied.trim()) return;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", copied);
    }
    document.addEventListener("copy", handleCopy);
    return () => document.removeEventListener("copy", handleCopy);
  }, []);

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

  if (!synced) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  return (
    <div className="bn-editor-wrapper h-full relative flex flex-col" ref={wrapperRef}>
      <div className="flex-1 min-h-0">
        <BlockNoteView
          editor={editor}
          editable={!readOnly}
          theme={bnTheme}
          className="h-full"
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
                          onClick={() => void runFormatSelection()}
                          title="Format selected text"
                          disabled={selectionBusy !== null}
                        >
                          {selectionBusy === "format" ? (
                            <span className="loading loading-spinner w-3.5 h-3.5" />
                          ) : (
                            <Wand2 className="w-3.5 h-3.5" />
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
      </div>

      <dialog className={`modal ${SHOW_AI_FEATURES && aiPromptOpen ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-lg">
          <h3 className="font-semibold text-base-content text-lg mb-2">AI Write</h3>
          <p className="text-sm text-base-content/60 mb-3">
            {selectedText
              ? "Describe how to rewrite the selected text. AI will replace it."
              : "Describe what to write. Content will be inserted at the cursor."}
          </p>
          <textarea
            className="textarea textarea-bordered bg-base-100 w-full min-h-28"
            placeholder="e.g. Write a detailed API requirements section..."
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
            <button
              className="btn btn-primary"
              onClick={() => void runWriteAi()}
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
});

export default DocumentEditor;

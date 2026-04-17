"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, Plus, Send, Sparkles, X } from "lucide-react";
import { AiMarkdown } from "./AiMarkdown";

type Message = { role: "user" | "assistant"; content: string };

interface AISidebarProps {
  userRole: string;
}

export function AISidebar({ userRole }: AISidebarProps) {
  const pathname = usePathname();
  if (userRole === "CLIENT") return null;
  if (pathname.includes("/projects/")) return null;
  return <AISidebarInner />;
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 900;

/**
 * Extract context IDs from the current URL path.
 * e.g. /projects/abc123/documents → { projectId: "abc123" }
 *      /tasks/xyz789            → { taskId: "xyz789" }
 *      /workspaces/ws1          → { workspaceId: "ws1" }
 */
function usePageContext() {
  const pathname = usePathname();
  const projectMatch = pathname.match(/\/projects\/([^/]+)/);
  const taskMatch = pathname.match(/\/tasks\/([^/]+)/);
  const workspaceMatch = pathname.match(/\/workspaces\/([^/]+)/);
  return {
    projectId: projectMatch?.[1],
    taskId: taskMatch?.[1],
    workspaceId: workspaceMatch?.[1],
  };
}

export interface ChatAssistantProps {
  projectId?: string;
  taskId?: string;
  workspaceId?: string;
  className?: string;
}

export function ChatAssistant({ projectId, taskId, workspaceId, className = "" }: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const contextLabel = projectId ? "Project" : taskId ? "Task" : workspaceId ? "Social Media" : null;

  function newChat() {
    setMessages([]);
    setInput("");
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          projectId,
          taskId,
          workspaceId,
        }),
      });
      const data = (await res.json()) as { data?: { content: string } };
      const reply: Message = {
        role: "assistant",
        content: data.data?.content ?? "Sorry, I couldn't generate a response.",
      };
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      {/* Header (Minimal for ChatAssistant, AISidebar handles its own) */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-base-content text-sm">AI Assistant</span>
          {contextLabel && (
            <span className="badge badge-xs badge-primary">{contextLabel}</span>
          )}
        </div>
        <button className="btn btn-ghost btn-xs gap-1" onClick={newChat} title="New conversation">
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-base-200/30">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-base-content/30">
            <Sparkles className="w-8 h-8 opacity-20" />
            <div>
              <p className="text-sm font-medium">DevRolin Assistant</p>
              <p className="text-xs mt-0.5 max-w-[200px]">
                Ask me anything about this {contextLabel?.toLowerCase() || "workspace"}...
              </p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm break-words shadow-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-content rounded-br-sm whitespace-pre-wrap"
                  : "bg-base-100 text-base-content border border-base-300 rounded-bl-sm whitespace-normal"
              }`}
            >
              {m.role === "assistant" ? <AiMarkdown content={m.content} /> : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-base-100 border border-base-300 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
              <span className="loading loading-dots loading-sm text-primary" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-base-300 p-3 bg-base-100">
        <div className="flex items-end gap-2 bg-base-200/50 border border-base-300 rounded-xl px-3 py-2 focus-within:border-primary transition-colors">
          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent resize-none text-sm text-base-content placeholder-base-content/30 outline-none min-h-[36px] max-h-[120px]"
            placeholder="Ask anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className="btn btn-primary btn-sm btn-circle flex-shrink-0 mb-0.5"
            onClick={() => void send()}
            disabled={!input.trim() || loading}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-base-content/30 mt-1.5 text-center">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}

function AISidebarInner() {
  const [isDocked, setIsDocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState<number>(360);
  const resizingRef = useRef(false);

  const ctx = usePageContext();

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("ai-sidebar-width") : null;
    if (saved) {
      const n = Number.parseInt(saved, 10);
      if (Number.isFinite(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) setWidth(n);
    }
    const docked = localStorage.getItem("ai-sidebar-docked") === "true";
    setIsDocked(docked);
  }, []);

  const handleToggleDock = () => {
    setIsDocked(!isDocked);
    localStorage.setItem("ai-sidebar-docked", String(!isDocked));
    if (!isDocked) setOpen(true);
  };

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizingRef.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
      setWidth(next);
    }
    function onUp() {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try { localStorage.setItem("ai-sidebar-width", String(width)); } catch { /* noop */ }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [width]);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    resizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <>
      {!isDocked && (
        <motion.button
          drag
          dragConstraints={{ left: -window.innerWidth + 100, right: 0, top: -window.innerHeight + 100, bottom: 0 }}
          dragElastic={0.1}
          dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="fixed bottom-6 right-6 z-30 btn btn-primary btn-circle shadow-lg flex items-center justify-center"
          onClick={() => setOpen((o) => !o)}
          title="AI Assistant (Drag to move)"
        >
          <Sparkles className="w-5 h-5" />
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 z-40 flex flex-col bg-base-100 border-l border-base-300 shadow-2xl"
            style={{ maxWidth: "100vw", width: typeof window !== "undefined" && window.innerWidth >= 640 ? `${width}px` : "100%" }}
          >
            {/* Drag handle */}
            <div
              className="hidden sm:block absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-50"
              onMouseDown={startResize}
              title="Drag to resize"
            />

            {/* Custom Header for Sidebar Mode */}
            <div className="flex items-center justify-end px-2 py-1 bg-base-200 border-b border-base-300">
              <button
                className="btn btn-ghost btn-xs gap-1"
                onClick={handleToggleDock}
                title={isDocked ? "Pop out to floating widget" : "Dock to side"}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                {isDocked ? "Pop out" : "Dock"}
              </button>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <ChatAssistant 
              projectId={ctx.projectId} 
              taskId={ctx.taskId} 
              workspaceId={ctx.workspaceId} 
              className="flex-1"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/30 sm:hidden"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

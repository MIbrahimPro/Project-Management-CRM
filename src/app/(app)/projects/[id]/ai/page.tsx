"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Sparkles, Send, User } from "lucide-react";
import toast from "react-hot-toast";
import { AiMarkdown } from "@/components/ai/AiMarkdown";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  user?: { name: string } | null;
  createdAt: string;
};

export default function ProjectAIPage() {
  const params = useParams();
  const projectId = params.id as string;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/ai-chat`)
      .then(r => r.json())
      .then(d => {
        setMessages(d.data || []);
        setLoading(false);
      })
      .catch(() => toast.error("Failed to load history"));
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");

    // Optimistic update
    const tempId = Math.random().toString();
    setMessages(prev => [...prev, {
      id: tempId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString()
    }]);

    try {
      const res = await fetch(`/api/projects/${projectId}/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      
      // Refresh messages to get full history with real IDs
      const refreshRes = await fetch(`/api/projects/${projectId}/ai-chat`);
      const refreshData = await refreshRes.json();
      setMessages(refreshData.data || []);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] max-w-5xl mx-auto bg-base-100 rounded-2xl shadow-xl border border-base-300 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-base-300 bg-base-200/50">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-bold text-base-content">Project AI Assistant</h1>
          <p className="text-xs text-base-content/50">Shared team conversation · Context-aware tools enabled</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-base-100/50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-30">
            <Sparkles className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium">How can I help with this project?</p>
            <p className="text-sm">I can read milestones, tasks, documents, and chat history.</p>
          </div>
        )}
        
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`flex flex-col max-w-[85%] ${m.role === "user" ? "items-end" : "items-start"}`}>
              {m.user && (
                <span className="text-[10px] uppercase tracking-widest text-base-content/40 mb-1 ml-1">
                  {m.user.name}
                </span>
              )}
              <div
                className={`px-4 py-3 rounded-2xl shadow-sm text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-content rounded-tr-none"
                    : "bg-base-200 text-base-content border border-base-300 rounded-tl-none"
                }`}
              >
                {m.role === "assistant" ? <AiMarkdown content={m.content} /> : m.content}
              </div>
              <span className="text-[10px] text-base-content/30 mt-1">
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-base-200 border border-base-300 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
              <span className="loading loading-dots loading-sm text-primary" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-base-200/50 border-t border-base-300">
        <div className="flex items-end gap-3 bg-base-100 border border-base-300 rounded-xl px-4 py-2 focus-within:border-primary transition-colors shadow-inner">
          <textarea
            className="flex-1 bg-transparent resize-none text-sm text-base-content placeholder-base-content/30 outline-none py-2 min-h-[44px] max-h-[200px]"
            placeholder="Ask anything about the project..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
          />
          <button
            className="btn btn-primary btn-sm btn-circle mb-1"
            onClick={() => void send()}
            disabled={!input.trim() || sending}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

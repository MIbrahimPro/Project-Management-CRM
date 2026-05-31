"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, ChevronUp, AlertCircle, Check, FileEdit } from "lucide-react";
import toast from "react-hot-toast";
import { AiMarkdown } from "@/components/ai/AiMarkdown";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  user?: { name: string } | null;
  createdAt: string;
  pendingAction?: {
    type: "edit_document";
    documentId: string;
    title: string;
    proposedChanges: string;
  };
};

type PendingConfirmation = {
  messageId: string;
  type: "edit_document";
  documentId: string;
  title: string;
  proposedChanges: string;
};

interface FloatingAIChatProps {
  projectId: string;
}

export default function FloatingAIChat({ projectId }: FloatingAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [pendingConfirmations, setPendingConfirmations] = useState<PendingConfirmation[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages when opened
  useEffect(() => {
    if (!isOpen) return;
    
    fetch(`/api/projects/${projectId}/ai-chat`)
      .then(r => r.json())
      .then(d => {
        setMessages(d.data || []);
        setLoading(false);
      })
      .catch(() => toast.error("Failed to load history"));
  }, [isOpen, projectId]);

  // Scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

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
      
      // Check for pending confirmations in response
      if (data.pendingConfirmations) {
        setPendingConfirmations(prev => [...prev, ...data.pendingConfirmations]);
      }
      
      // Refresh messages
      const refreshRes = await fetch(`/api/projects/${projectId}/ai-chat`);
      const refreshData = await refreshRes.json();
      setMessages(refreshData.data || []);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function confirmAction(confirmation: PendingConfirmation, approved: boolean) {
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-chat/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: confirmation.messageId,
          approved,
          actionType: confirmation.type,
          documentId: confirmation.documentId,
        }),
      });

      if (!res.ok) throw new Error("Failed to process");

      // Remove from pending
      setPendingConfirmations(prev => prev.filter(p => p.messageId !== confirmation.messageId));
      
      // Refresh messages to show result
      const refreshRes = await fetch(`/api/projects/${projectId}/ai-chat`);
      const refreshData = await refreshRes.json();
      setMessages(refreshData.data || []);

      toast.success(approved ? "Changes applied" : "Changes rejected", {
        style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" }
      });
    } catch {
      toast.error("Failed to process confirmation");
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-content shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center z-50"
        title="AI Assistant"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[450px] h-[600px] bg-base-100 rounded-2xl shadow-2xl border border-base-300 flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-200/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-base-content">Project AI</h3>
            <p className="text-[10px] text-base-content/50">Context-aware · Can edit docs</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="btn btn-ghost btn-sm btn-circle"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-base-100/50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
            <Sparkles className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium">How can I help?</p>
            <p className="text-xs mt-1">Ask about milestones, tasks, docs, or request edits</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex flex-col max-w-[90%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`px-3 py-2 rounded-xl text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-content rounded-tr-none"
                      : "bg-base-200 text-base-content border border-base-300 rounded-tl-none"
                  }`}
                >
                  {m.role === "assistant" ? <AiMarkdown content={m.content} /> : m.content}
                </div>
                <span className="text-[9px] text-base-content/30 mt-0.5">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}

        {/* Pending Confirmations */}
        {pendingConfirmations.map((confirmation) => (
          <div key={confirmation.messageId} className="bg-warning/10 border border-warning/30 rounded-xl p-3 mx-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-base-content">
                  <FileEdit className="w-3 h-3 inline mr-1" />
                  Edit Request: {confirmation.title}
                </p>
                <p className="text-[10px] text-base-content/60 mt-1 line-clamp-3">
                  {confirmation.proposedChanges.slice(0, 100)}...
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => confirmAction(confirmation, true)}
                    className="btn btn-xs btn-success gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Approve
                  </button>
                  <button
                    onClick={() => confirmAction(confirmation, false)}
                    className="btn btn-xs btn-ghost text-error gap-1"
                  >
                    <X className="w-3 h-3" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-base-200 border border-base-300 rounded-xl rounded-tl-none px-3 py-2">
              <span className="loading loading-dots loading-sm text-primary" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-base-200/50 border-t border-base-300">
        <div className="flex items-end gap-2 bg-base-100 border border-base-300 rounded-xl px-3 py-2 focus-within:border-primary transition-colors">
          <textarea
            className="flex-1 bg-transparent resize-none text-sm text-base-content placeholder-base-content/40 outline-none min-h-[36px] max-h-[120px]"
            placeholder="Ask or request edits..."
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
            className="btn btn-primary btn-sm btn-circle"
            onClick={() => void send()}
            disabled={!input.trim() || sending}
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

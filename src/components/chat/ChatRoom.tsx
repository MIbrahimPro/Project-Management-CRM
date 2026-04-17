"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import {
  Download,
  Mic,
  Paperclip,
  Reply,
  Send,
  Settings,
  Smile,
  Trash2,
  Video,
  X,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { AvatarStack } from "@/components/projects/AvatarStack";
import { usePresence } from "@/components/layout/PresenceProvider";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import toast from "react-hot-toast";

dayjs.extend(relativeTime);

// ── Types ────────────────────────────────────────────────────────────────────

interface Sender {
  id: string;
  name: string;
  profilePicUrl: string | null;
  role: string;
  clientColor: string;
}

interface ReplyPreview {
  id: string;
  content: string | null;
  sender: { name: string } | null;
}

interface Reaction {
  id: string;
  emoji: string;
  userId: string;
}

interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  isAiResponse: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  sender: Sender | null;
  replyTo: ReplyPreview | null;
  reactions: Reaction[];
}

interface ChatRoomProps {
  roomId: string;
  roomName: string;
  currentUser: {
    id: string;
    name: string;
    role: string;
    clientColor: string;
    profilePicUrl?: string | null;
  };
  onStartMeeting?: () => void;
  showMeetingButton?: boolean;
  showSenderInfo?: boolean;
  refreshTrigger?: number;
  roomDetails?: {
    id: string;
    type: string;
    name: string | null;
    adminsOnlyPosting?: boolean;
    avatarUrl?: string | null;
    createdById?: string;
    members: { 
      userId: string; 
      user: { id: string; name: string; role: string; profilePicUrl: string | null }; 
      isGroupAdmin?: boolean 
    }[];
  };
}

// ── Common emojis (no external package) ─────────────────────────────────────
const COMMON_EMOJIS = [
  "👍","❤️","😂","🎉","😊","🔥","👏","🙌","💯","✅",
  "😅","🤔","👀","💪","🚀","⭐","✨","😍","🙏","😎",
];

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-16 right-3 z-50 bg-base-200 border border-base-300 rounded-xl shadow-xl p-2 w-48">
      <div className="flex flex-wrap gap-1">
        {COMMON_EMOJIS.map((e) => (
          <button
            key={e}
            className="text-lg p-1 rounded hover:bg-base-300 transition-colors"
            onClick={() => onSelect(e)}
          >
            {e}
          </button>
        ))}
      </div>
      <button
        className="w-full mt-1 text-xs text-base-content/40 hover:text-base-content/60"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}

// ── Image lightbox modal ──────────────────────────────────────────────────────
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt="preview" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
        <div className="absolute top-2 right-2 flex gap-2">
          <a
            href={src}
            download
            className="btn btn-sm btn-circle bg-base-300/80 hover:bg-base-300 border-0"
            title="Download"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="w-4 h-4" />
          </a>
          <button className="btn btn-sm btn-circle bg-base-300/80 hover:bg-base-300 border-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function VoicePlayer({ src, isOwn }: { src: string; isOwn: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (playing) audioRef.current?.pause();
    else audioRef.current?.play();
    setPlaying(!playing);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`flex items-center gap-3 p-2 rounded-xl border ${
      isOwn ? "bg-primary-content/10 border-primary-content/20" : "bg-base-300 border-base-300"
    } min-w-[200px] mt-1`}>
      <audio ref={audioRef} src={src} />
      <button
        onClick={togglePlay}
        className={`btn btn-circle btn-xs ${isOwn ? "btn-ghost text-primary-content" : "btn-primary text-primary-content"}`}
      >
        {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className={`range range-xs ${isOwn ? "range-primary-content" : "range-primary"}`}
        />
        <div className="flex justify-between text-[10px] opacity-60">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Media renderer ────────────────────────────────────────────────────────────
function MessageMedia({ mediaUrl, mediaType, isOwn }: { mediaUrl: string; mediaType: string; isOwn: boolean }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    setSignedUrl(mediaType === "meeting_invite" ? mediaUrl : null);

    if (mediaType === "meeting_invite") {
      return () => {
        cancelled = true;
      };
    }

    fetch(`/api/storage/signed-url?path=${encodeURIComponent(mediaUrl)}`, {
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`signed-url ${r.status}`);
        return r.json() as Promise<{ url?: string }>;
      })
      .then((d) => {
        if (cancelled) return;
        if (d.url) setSignedUrl(d.url);
        else setLoadError(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaType, mediaUrl]);

  if (loadError) {
    return (
      <span className="text-xs text-error mt-1 block" title={mediaUrl}>
        Attachment could not be loaded
      </span>
    );
  }
  if (!signedUrl) return <span className="loading loading-spinner loading-xs mt-1" />;

  if (mediaType === "meeting_invite") {
    return (
      <div className="mt-2">
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
            isOwn
              ? "border-base-300 bg-base-100 text-base-content hover:bg-base-200"
              : "border-primary/60 bg-primary text-primary-content hover:opacity-90"
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          Join meeting
        </a>
      </div>
    );
  }

  if (mediaType === "image") {
    return (
      <>
        <button type="button" onClick={() => setLightboxOpen(true)} className="block cursor-pointer">
          <img
            src={signedUrl}
            alt="media"
            className="max-w-xs max-h-64 rounded-lg object-cover mt-1 hover:opacity-90 transition-opacity"
          />
        </button>
        {lightboxOpen && <ImageLightbox src={signedUrl} onClose={() => setLightboxOpen(false)} />}
      </>
    );
  }
  if (mediaType === "voice") {
    return <VoicePlayer src={signedUrl} isOwn={isOwn} />;
  }
  if (mediaType === "video") {
    return (
      <video controls src={signedUrl} className="max-w-xs max-h-48 rounded-lg mt-1" />
    );
  }
  return (
    <a
      href={signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mt-1 p-2 bg-black/20 rounded-lg text-xs hover:bg-black/30 transition-colors"
    >
      📎 Download file
    </a>
  );
}

// ── Main ChatRoom ─────────────────────────────────────────────────────────────
export function ChatRoom({
  roomId,
  roomName,
  currentUser,
  onStartMeeting,
  showMeetingButton = false,
  showSenderInfo = true,
  refreshTrigger = 0,
  roomDetails,
}: ChatRoomProps) {
  const presenceMap = usePresence();
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [emojiPickerFor, setEmojiPickerFor] = useState<"input" | string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [recordingTime, setRecordingTime] = useState(0);

  const LONG_MESSAGE_THRESHOLD = 500;

  function MessageContent({ content, msgId, isOwn }: { content: string; msgId: string; isOwn: boolean }) {
    const isExpanded = expandedMessages.has(msgId);
    const shouldTruncate = content.length > LONG_MESSAGE_THRESHOLD && !isExpanded;
    const displayContent = shouldTruncate ? content.slice(0, LONG_MESSAGE_THRESHOLD) + "..." : content;

    return (
      <div className="flex flex-col gap-1">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node, ...props }) => (
              <a
                {...props}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-primary transition-colors break-all"
                onClick={(e) => e.stopPropagation()}
              />
            ),
            p: ({ node, ...props }) => <p {...props} className="whitespace-pre-wrap break-words" />,
          }}
        >
          {displayContent}
        </ReactMarkdown>
        {content.length > LONG_MESSAGE_THRESHOLD && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedMessages((prev) => {
                const next = new Set(prev);
                if (isExpanded) next.delete(msgId);
                else next.add(msgId);
                return next;
              });
            }}
            className={`flex items-center gap-1 text-[10px] font-bold uppercase mt-1 hover:opacity-80 transition-opacity ${
              isOwn ? "text-primary-content/80" : "text-primary"
            }`}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" /> Read more
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  // Manage Group State
  const [showManageGroup, setShowManageGroup] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [editingAdminsOnly, setEditingAdminsOnly] = useState(false);
  const [editingAvatarUrl, setEditingAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingMembers, setEditingMembers] = useState<string[]>([]);
  const [editingAdmins, setEditingAdmins] = useState<string[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [allUsersCache, setAllUsersCache] = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { socket, connected } = useSocket("/chat");

  // ── Load messages ──────────────────────────────────────────────────────────
  const loadMessages = useCallback(
    async (cursor?: string) => {
      const url = `/api/chat/rooms/${roomId}/messages${cursor ? `?cursor=${cursor}` : ""}`;
      const res = await fetch(url);
      const data = (await res.json()) as {
        data: { messages: Message[]; nextCursor: string | null };
      };
      if (cursor) {
        setMessages((prev) => [...data.data.messages, ...prev]);
        setLoadingMore(false);
      } else {
        setMessages(data.data.messages);
        setLoading(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView(), 100);
      }
      setNextCursor(data.data.nextCursor);
    },
    [roomId]
  );

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    void loadMessages();
  }, [loadMessages, refreshTrigger]);

  // ── Socket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !connected) return;

    socket.emit("join_room", roomId);

    function onNewMessage(msg: Message) {
      if (msg.roomId === roomId) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        socket!.emit("mark_read", roomId);
      }
    }
    function onTyping({ userId, roomId: rid }: { userId: string; roomId: string }) {
      if (rid === roomId && userId !== currentUser.id) {
        setTypingUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      }
    }
    function onStoppedTyping({ userId, roomId: rid }: { userId: string; roomId: string }) {
      if (rid === roomId) setTypingUsers((prev) => prev.filter((id) => id !== userId));
    }
    function onReacted({ messageId, reactions }: { messageId: string; reactions: Reaction[] }) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    }

    function onMessageDeleted({ messageId }: { messageId: string }) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m
        )
      );
    }

    socket.on("new_message", onNewMessage);
    socket.on("user_typing", onTyping);
    socket.on("user_stopped_typing", onStoppedTyping);
    socket.on("message_reacted", onReacted);
    socket.on("message_deleted", onMessageDeleted);
    socket.emit("mark_read", roomId);

    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("user_typing", onTyping);
      socket.off("user_stopped_typing", onStoppedTyping);
      socket.off("message_reacted", onReacted);
      socket.off("message_deleted", onMessageDeleted);
    };
  }, [socket, connected, roomId, currentUser.id]);

  // ── Typing indicator ───────────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    if (socket) {
      socket.emit("typing_start", roomId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing_stop", roomId);
      }, 2000);
    }
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
  }

  // ── Send message ───────────────────────────────────────────────────────────
  function sendMessage() {
    if (!socket || !input.trim()) return;
    socket.emit("send_message", {
      roomId,
      content: input.trim(),
      replyToId: replyTo?.id ?? undefined,
    });
    setInput("");
    setReplyTo(null);
    socket.emit("typing_stop", roomId);
    if (inputRef.current) inputRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── File upload ────────────────────────────────────────────────────────────
  async function sendFile(file: File, type: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    const res = await fetch("/api/chat/upload", { method: "POST", body: formData, credentials: "include" });
    const data = (await res.json()) as { data?: { path: string; type: string }; error?: string };
    if (!res.ok || !data.data) {
      toast.error(data.error ?? "Upload failed");
      return;
    }

    const payload = {
      mediaUrl: data.data.path,
      mediaType: data.data.type,
      replyToId: replyTo?.id,
    };

    const createRes = await fetch(`/api/chat/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const created = (await createRes.json()) as { data?: { message: Message }; error?: string };

    if (!createRes.ok) {
      toast.error(typeof created.error === "string" ? created.error : "Could not save message");
      return;
    }

    if (!connected && created.data?.message) {
      setMessages((prev) => [...prev, created.data!.message]);
    }
    setReplyTo(null);
  }

  async function handleDeleteMessage(messageId: string) {
    if (!confirm("Are you sure you want to delete this message for everyone?")) return;
    try {
      const res = await fetch(`/api/chat/messages/${messageId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete");
      }
      toast.success("Message deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
      ? "video"
      : "document";
    void sendFile(file, type);
    e.target.value = "";
  }

  // ── Voice recording ────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        void sendFile(new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" }), "voice");
        stream.getTracks().forEach((t) => t.stop());
        setRecordingTime(0);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => {
          if (t >= 119) { stopRecording(); return 0; }
          return t + 1;
        });
      }, 1000);
    } catch {
      alert("Microphone access denied");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }

  // ── Reactions ─────────────────────────────────────────────────────────────
  function handleEmojiSelect(emoji: string) {
    if (emojiPickerFor === "input") {
      setInput((prev) => prev + emoji);
      inputRef.current?.focus();
    } else if (emojiPickerFor) {
      socket?.emit("react", { messageId: emojiPickerFor, emoji });
    }
    setEmojiPickerFor(null);
  }

  function groupReactions(reactions: Reaction[]) {
    const map: Record<string, { emoji: string; count: number; userIds: string[] }> = {};
    for (const r of reactions) {
      map[r.emoji] ??= { emoji: r.emoji, count: 0, userIds: [] };
      map[r.emoji].count++;
      map[r.emoji].userIds.push(r.userId);
    }
    return Object.values(map);
  }

  function formatRecordingTime(s: number) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  }

  const isGlobalManager = ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER"].includes(currentUser.role);
  const isCustomGroup = roomDetails?.type === "custom_group";
  const currentUserMember = roomDetails?.members?.find(m => m.userId === currentUser.id);
  const isGroupAdmin = currentUserMember?.isGroupAdmin;
  const canManageGroup = isCustomGroup && (isGroupAdmin || isGlobalManager);
  const canPost = !isCustomGroup || !roomDetails?.adminsOnlyPosting || isGroupAdmin || isGlobalManager;

  async function handleOpenManageGroup() {
    setEditingName(roomDetails?.name || "");
    setEditingAdminsOnly(roomDetails?.adminsOnlyPosting || false);
    setEditingAvatarUrl(roomDetails?.avatarUrl || null);
    setEditingMembers(roomDetails?.members?.map(m => m.userId) || []);
    setEditingAdmins(roomDetails?.members?.filter(m => m.isGroupAdmin).map(m => m.userId) || []);
    setShowManageGroup(true);
    if (allUsersCache.length === 0) {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        setAllUsersCache(data.data || []);
      } catch (e) {
        toast.error("Failed to load users");
      }
    }
  }

  async function handleSaveGroup() {
    if (!editingName.trim() || editingMembers.length === 0) {
      toast.error("Name and at least 1 member required");
      return;
    }
    setSavingGroup(true);
    try {
      const res = await fetch(`/api/chat/rooms/custom-group/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingName,
          userIds: editingMembers,
          adminIds: editingAdmins,
          adminsOnlyPosting: editingAdminsOnly,
          avatarUrl: editingAvatarUrl,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Group saved");
      setShowManageGroup(false);
      if (typeof window !== "undefined") window.location.reload(); // Simple refresh for now to update parent state
    } catch (e) {
      toast.error("Failed to save group");
    } finally {
      setSavingGroup(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full bg-base-100">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-base-200 border-b border-base-300 flex-shrink-0">
        <div className="flex items-center gap-3">
          {roomDetails?.type === "custom_group" && roomDetails.avatarUrl ? (
            <UserAvatar user={{ name: roomName, profilePicUrl: roomDetails.avatarUrl }} size={32} />
          ) : roomDetails?.members && roomDetails.type !== "general_dm" ? (
            <AvatarStack users={roomDetails.members.slice(0, 3).map(m => m.user)} overflow={Math.max(0, roomDetails.members.length - 3)} />
          ) : null}
          <div className="flex flex-col">
            <h2 className="font-semibold text-base-content leading-tight flex items-center gap-2">
              {roomName}
              {roomDetails?.type === "general_dm" ? (
                <span
                  className={`w-2 h-2 rounded-full ${
                    roomDetails.members.some(m => m.userId !== currentUser.id && presenceMap[m.userId] === "online") ? "bg-success" : "bg-base-content/30"
                  }`}
                />
              ) : (
                <span
                  className={`w-2 h-2 rounded-full ${connected ? "bg-success" : "bg-base-content/20"}`}
                  title={connected ? "Socket connected" : "Socket disconnected"}
                />
              )}
            </h2>
            {roomDetails?.type !== "general_dm" && roomDetails?.members && (
              <div className="dropdown dropdown-hover">
                <label
                  tabIndex={0}
                  className="text-xs text-base-content/60 font-medium mt-0.5 cursor-pointer hover:text-primary transition-colors flex items-center gap-1"
                >
                  {roomDetails.members.length} members • {roomDetails.members.filter(m => presenceMap[m.userId] === "online").length} online
                </label>
                <div
                  tabIndex={0}
                  className="dropdown-content z-[60] card card-compact w-64 p-2 shadow-xl bg-base-200 border border-base-300 ml-[-10px] mt-1"
                >
                  <div className="card-body p-1 max-h-80 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2 px-2 pt-1">
                      <h3 className="font-bold text-xs uppercase tracking-wider opacity-50">Members</h3>
                      <span className="badge badge-ghost badge-xs text-[10px]">{roomDetails.members.length}</span>
                    </div>
                    <div className="space-y-0.5">
                      {roomDetails.members
                        .sort((a, b) => {
                          const aOnline = presenceMap[a.userId] === "online";
                          const bOnline = presenceMap[b.userId] === "online";
                          if (aOnline && !bOnline) return -1;
                          if (!aOnline && bOnline) return 1;
                          return a.user.name.localeCompare(b.user.name);
                        })
                        .map((m) => (
                          <div
                            key={m.userId}
                            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-base-300 transition-colors group"
                          >
                            <UserAvatar
                              user={m.user}
                              size={28}
                              showPresence
                              isOnline={presenceMap[m.userId] === "online"}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate flex items-center gap-1">
                                {m.user.name}
                                {m.isGroupAdmin && (
                                  <span className="text-[10px] text-primary font-bold">★</span>
                                )}
                              </p>
                              <p className="text-[10px] opacity-60 uppercase tracking-tighter">
                                {m.user.role.toLowerCase().replace("_", " ")}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {showMeetingButton && onStartMeeting && (
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={onStartMeeting}
              title="Start meeting"
            >
              <Video className="w-4 h-4 text-primary" />
            </button>
          )}
          {canManageGroup && (
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={handleOpenManageGroup}
              title="Manage Group"
            >
              <Settings className="w-4 h-4 text-base-content/70" />
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {nextCursor && (
          <div className="text-center mb-2">
            <button
              className="btn btn-ghost btn-xs text-base-content/50"
              onClick={() => {
                setLoadingMore(true);
                void loadMessages(nextCursor);
              }}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                "Load older messages"
              )}
            </button>
          </div>
        )}

        {messages.map((msg, i) => {
          const isOwn = msg.senderId === currentUser.id;
          const prevMsg = messages[i - 1];
          const showDate =
            !prevMsg || !dayjs(msg.createdAt).isSame(prevMsg.createdAt, "day");
          const showSender =
            showSenderInfo && (!prevMsg || prevMsg.senderId !== msg.senderId);
          const isDeleted = !!msg.deletedAt;
          const isAI = msg.isAiResponse;
          const isClientMsg = msg.sender?.role === "CLIENT";

          const reactionGroups = groupReactions(msg.reactions ?? []);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-base-300" />
                  <span className="text-xs text-base-content/40">
                    {dayjs(msg.createdAt).format("MMMM D, YYYY")}
                  </span>
                  <div className="flex-1 h-px bg-base-300" />
                </div>
              )}

              <div
                className={`group flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                {showSenderInfo && (
                  <div className="flex-shrink-0 self-end">
                    <UserAvatar
                      user={
                        isOwn
                          ? {
                              name: currentUser.name,
                              profilePicUrl: currentUser.profilePicUrl ?? null,
                            }
                          : {
                              name: msg.sender?.name ?? "?",
                              profilePicUrl: msg.sender?.profilePicUrl ?? null,
                            }
                      }
                      size={28}
                    />
                  </div>
                )}

                <div
                  className={`max-w-[70%] flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}
                >
                  {showSender && showSenderInfo && !isOwn && (
                    <span className="text-xs font-medium text-base-content/60 px-1">
                      {msg.sender?.name}
                    </span>
                  )}

                  {/* Reply preview */}
                  {msg.replyTo && (
                    <div
                      className={`text-xs px-2 py-1 rounded bg-base-300 border-l-2 border-primary mb-0.5 max-w-full ${isOwn ? "text-right" : ""}`}
                    >
                      <span className="font-medium text-primary">
                        {msg.replyTo.sender?.name}
                      </span>
                      <p className="text-base-content/60 truncate">
                        {msg.replyTo.content ?? "[media]"}
                      </p>
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`relative px-3 py-2 rounded-2xl text-sm ${
                      isOwn
                        ? "bg-primary text-primary-content rounded-tr-sm"
                        : isAI
                        ? "bg-base-300 text-base-content border border-primary/20 rounded-tl-sm"
                        : "bg-base-200 text-base-content rounded-tl-sm"
                    } ${isDeleted ? "opacity-50 italic" : ""}`}
                    style={
                      isClientMsg && !isOwn
                        ? { borderLeft: `3px solid ${msg.sender?.clientColor ?? "#06b6d4"}` }
                        : {}
                    }
                  >
                    {isAI && (
                      <span className="text-xs text-primary/70 block mb-1 font-medium">
                        ✦ AI
                      </span>
                    )}

                    {isDeleted ? (
                      <span className="text-base-content/40">Message deleted</span>
                    ) : (
                      <>
                        {msg.content && (
                          <MessageContent 
                            content={msg.content} 
                            msgId={msg.id} 
                            isOwn={isOwn} 
                          />
                        )}
                        {msg.mediaUrl && msg.mediaType && (
                          <MessageMedia
                            mediaUrl={msg.mediaUrl}
                            mediaType={msg.mediaType}
                            isOwn={isOwn}
                          />
                        )}
                      </>
                    )}

                    <div
                      className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : ""}`}
                    >
                      <span className="text-xs opacity-50">
                        {dayjs(msg.createdAt).format("HH:mm")}
                      </span>
                      {msg.editedAt && (
                        <span className="text-xs opacity-40">(edited)</span>
                      )}
                    </div>

                    {/* Hover actions */}
                    {!isDeleted && (
                      <div
                        className={`absolute -top-10 ${
                          isOwn ? "right-0" : "left-0"
                        } hidden group-hover:flex items-center gap-1 p-1 bg-base-200 border border-base-300 rounded-xl shadow-lg z-20`}
                      >
                        {/* Quick Reactions */}
                        <div className="flex items-center gap-0.5 border-r border-base-300 pr-1 mr-0.5">
                          {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                            <button
                              key={emoji}
                              className="w-6 h-6 flex items-center justify-center hover:bg-base-300 rounded-md transition-all hover:scale-125"
                              onClick={() => socket?.emit("react", { messageId: msg.id, emoji })}
                            >
                              <span className="text-sm">{emoji}</span>
                            </button>
                          ))}
                        </div>

                        <button
                          title="Reply"
                          className="p-1 hover:text-primary rounded text-base-content/70 hover:bg-base-300 transition-colors"
                          onClick={() => setReplyTo(msg)}
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="More emojis"
                          className="p-1 hover:text-primary rounded text-base-content/70 hover:bg-base-300 transition-colors"
                          onClick={() => setEmojiPickerFor(msg.id)}
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>
                        {(isOwn || currentUser.role === "SUPER_ADMIN") && (
                          <button
                            title="Delete"
                            className="p-1 hover:text-error rounded text-base-content/70 hover:bg-base-300 transition-colors"
                            onClick={() => handleDeleteMessage(msg.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Reactions */}
                  {reactionGroups.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-1">
                      {reactionGroups.map((r) => (
                        <button
                          key={r.emoji}
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                            r.userIds.includes(currentUser.id)
                              ? "bg-primary/20 border-primary/30 text-primary"
                              : "bg-base-300 border-base-300 hover:border-base-content/30"
                          }`}
                          onClick={() =>
                            socket?.emit("react", { messageId: msg.id, emoji: r.emoji })
                          }
                        >
                          <span>{r.emoji}</span>
                          <span className="text-base-content/60">{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 py-1 pl-9">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-base-content/40 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
            <span className="text-xs text-base-content/40">typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Emoji picker */}
      {emojiPickerFor && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={() => setEmojiPickerFor(null)}
        />
      )}

      {/* ── Input area ── */}
      <div className="flex-shrink-0 border-t border-base-300 bg-base-200 p-3">
        {/* Reply preview */}
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-base-300 rounded-lg text-sm">
            <Reply className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-primary font-medium text-xs">
                {replyTo.sender?.name}
              </span>
              <p className="text-base-content/60 truncate text-xs">
                {replyTo.content ?? "[media]"}
              </p>
            </div>
            <button
              className="btn btn-ghost btn-xs btn-circle"
              onClick={() => setReplyTo(null)}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {!canPost ? (
          <div className="p-3 text-center text-sm text-base-content/50 italic bg-base-300 rounded-lg">
            Only admins can post in this group.
          </div>
        ) : isRecording ? (
          <div className="flex items-center gap-3 p-2 bg-error/10 rounded-xl border border-error/30">
            <div className="w-2 h-2 rounded-full bg-error animate-pulse flex-shrink-0" />
            <span className="text-sm text-error flex-1">
              Recording — {formatRecordingTime(recordingTime)}
            </span>
            <button className="btn btn-error btn-sm" onClick={stopRecording}>
              Send
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                mediaRecorderRef.current?.stop();
                setIsRecording(false);
                if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            {/* Attachment */}
            <label
              className="btn btn-ghost btn-sm btn-circle flex-shrink-0 self-end"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4 text-base-content/60" />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {/* Emoji */}
            <button
              className="btn btn-ghost btn-sm btn-circle flex-shrink-0 self-end"
              onClick={() => setEmojiPickerFor("input")}
            >
              <Smile className="w-4 h-4 text-base-content/60" />
            </button>

            {/* Text input */}
            <textarea
              ref={inputRef}
              className="flex-1 textarea textarea-ghost resize-none bg-base-100 rounded-xl border border-base-300 focus:outline-none focus:border-primary min-h-[2.5rem] max-h-32 py-2 text-sm"
              placeholder="Message..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
            />

            {/* Voice note button */}
            {!input.trim() && (
              <button
                className="btn btn-ghost btn-sm btn-circle flex-shrink-0 self-end"
                onMouseDown={() => void startRecording()}
                title="Record voice note"
              >
                <Mic className="w-4 h-4 text-base-content/60" />
              </button>
            )}

            {/* Send */}
            {input.trim() && (
              <button
                className="btn btn-primary btn-sm btn-circle flex-shrink-0 self-end"
                onClick={sendMessage}
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* AI slash command hint */}
        {(input.startsWith("/professionalize") || input.startsWith("/email")) && (
          <p className="text-xs text-primary/70 mt-1 px-1">
            AI will process this message and send the result
          </p>
        )}
      </div>

      {/* Manage Group Modal */}
      {showManageGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-base-100 rounded-xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-base-300 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Manage Group</h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowManageGroup(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="form-control">
              <div className="flex items-center gap-4 mb-4">
                <UserAvatar user={{ name: editingName || "Group", profilePicUrl: editingAvatarUrl }} size={64} />
                <div className="flex-1">
                  <label className="btn btn-sm btn-outline">
                    {uploadingAvatar ? <span className="loading loading-spinner loading-xs" /> : "Upload Image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingAvatar(true);
                        const formData = new FormData();
                        formData.append("file", file);
                        formData.append("type", "image");
                        try {
                          const res = await fetch("/api/chat/upload", { method: "POST", body: formData });
                          const data = await res.json();
                          if (res.ok && data.data?.path) setEditingAvatarUrl(data.data.path);
                          else throw new Error(data.error || "Upload failed");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Upload failed");
                        } finally {
                          setUploadingAvatar(false);
                        }
                      }}
                    />
                  </label>
                  {editingAvatarUrl && (
                    <button className="btn btn-sm btn-ghost text-error ml-2" onClick={() => setEditingAvatarUrl(null)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <label className="label text-xs font-semibold">Group Name</label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label text-xs font-semibold flex items-center justify-between">
                  <span>Members</span>
                  <span className="text-base-content/50">Admin?</span>
                </label>
                <div className="border border-base-300 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {allUsersCache.filter(u => (u.id !== currentUser.id || !isGroupAdmin) && u.role !== "CLIENT" && u.role !== "SUPER_ADMIN").map(u => (
                    <div key={u.id} className="flex items-center justify-between p-2 hover:bg-base-200 border-b border-base-300 last:border-0">
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={editingMembers.includes(u.id) || (u.id === currentUser.id && isGroupAdmin)}
                          disabled={u.id === currentUser.id && isGroupAdmin}
                          onChange={(e) => {
                            if (e.target.checked) setEditingMembers(prev => [...prev, u.id]);
                            else {
                              setEditingMembers(prev => prev.filter(id => id !== u.id));
                              setEditingAdmins(prev => prev.filter(id => id !== u.id));
                            }
                          }}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{u.name} {u.id === currentUser.id ? "(You)" : ""}</span>
                          <span className="text-xs text-base-content/60">{u.role}</span>
                        </div>
                      </label>
                      {editingMembers.includes(u.id) || (u.id === currentUser.id && isGroupAdmin) ? (
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
                          title="Make Admin"
                          checked={editingAdmins.includes(u.id) || (u.id === currentUser.id && isGroupAdmin)}
                          disabled={u.id === currentUser.id && isGroupAdmin}
                          onChange={(e) => {
                            if (e.target.checked) setEditingAdmins(prev => [...prev, u.id]);
                            else setEditingAdmins(prev => prev.filter(id => id !== u.id));
                          }}
                        />
                      ) : <div className="w-6" />}
                    </div>
                  ))}
                  {allUsersCache.length <= 1 && (
                    <div className="p-3 text-sm text-center text-base-content/40">No other users available</div>
                  )}
                </div>
              </div>

              <div className="form-control flex-row items-center justify-between p-3 border border-base-300 rounded-lg">
                <div>
                  <span className="label-text font-semibold block">Only Admins Can Post</span>
                  <span className="text-xs text-base-content/60">Restrict posting to group admins only</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={editingAdminsOnly}
                  onChange={(e) => setEditingAdminsOnly(e.target.checked)}
                />
              </div>
            </div>
            <div className="p-4 border-t border-base-300 bg-base-200/50 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setShowManageGroup(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSaveGroup}
                disabled={savingGroup || !editingName.trim() || editingMembers.length === 0}
              >
                {savingGroup ? <span className="loading loading-spinner loading-sm" /> : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

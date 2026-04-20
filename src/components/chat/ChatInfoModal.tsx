"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Info, Users, Image as ImageIcon, Link as LinkIcon, Mic, LogOut, Trash2, Camera, UserPlus, Download, ExternalLink, Play, Calendar } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { motion, AnimatePresence } from "framer-motion";
import dayjs from "dayjs";
import toast from "react-hot-toast";

interface ChatInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  roomType: string;
  members: {
    userId: string;
    user: { id: string; name: string; role: string; profilePicUrl: string | null };
    isGroupAdmin?: boolean;
  }[];
  currentUser: { id: string; role: string };
  onUpdateGroup?: (data: any) => Promise<void>;
  onLeaveGroup?: () => Promise<void>;
  onDeleteGroup?: () => Promise<void>;
}

type Tab = "overview" | "members" | "media" | "links" | "recordings";

export function ChatInfoModal({
  isOpen,
  onClose,
  roomId,
  roomName,
  roomType,
  members,
  currentUser,
  onUpdateGroup,
  onLeaveGroup,
  onDeleteGroup,
}: ChatInfoModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [media, setMedia] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Group edit state
  const [editingName, setEditingName] = useState(roomName);
  const [isSaving, setIsSaving] = useState(false);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/media`);
      const data = await res.json();
      setMedia(data.data || []);
    } catch (e) {
      toast.error("Failed to fetch media");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/links`);
      const data = await res.json();
      setLinks(data.data || []);
    } catch (e) {
      toast.error("Failed to fetch links");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/recordings`);
      const data = await res.json();
      setRecordings(data.data || []);
    } catch (e) {
      toast.error("Failed to fetch recordings");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === "media") void fetchMedia();
      if (activeTab === "links") void fetchLinks();
      if (activeTab === "recordings") void fetchRecordings();
    }
  }, [isOpen, activeTab, roomId, fetchMedia, fetchLinks, fetchRecordings]);

  async function handleRename() {
    if (!editingName.trim() || editingName === roomName) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/chat/rooms/custom-group/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName }),
      });
      if (!res.ok) throw new Error("Failed to rename");
      toast.success("Group renamed");
      if (typeof window !== "undefined") window.location.reload();
    } catch (e) {
      toast.error("Failed to rename group");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOpenDM(targetUserId: string) {
    if (targetUserId === currentUser.id) return;
    try {
      const res = await fetch("/api/chat/rooms/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open DM");
      
      // Navigate to chat if in browser
      if (typeof window !== "undefined") {
        window.location.href = `/chat?roomId=${data.data.id}`;
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleLeave() {
    if (!confirm("Are you sure you want to leave this group?")) return;
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/leave`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to leave");
      toast.success("Left group");
      if (typeof window !== "undefined") window.location.href = "/chat";
    } catch (e) {
      toast.error("Failed to leave group");
    }
  }

  if (!isOpen) return null;

  const isCustomGroup = roomType === "custom_group";
  const currentUserMember = members.find((m) => m.userId === currentUser.id);
  const isGroupAdmin = currentUserMember?.isGroupAdmin || ["ADMIN", "PROJECT_MANAGER"].includes(currentUser.role);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-2xl bg-base-100 border border-base-300 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-200/50">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Chat Info
          </h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-base-300 px-6 bg-base-200/20">
          {[
            { id: "overview", label: "Overview", icon: Info },
            { id: "members", label: "Members", icon: Users },
            { id: "media", label: "Media", icon: ImageIcon },
            { id: "links", label: "Links", icon: LinkIcon },
            { id: "recordings", label: "Recordings", icon: Mic },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-base-content/60 hover:text-base-content hover:bg-base-300/30"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-base-200/10">
          <AnimatePresence mode="wait">
            {activeTab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative group">
                    <UserAvatar user={{ name: roomName, profilePicUrl: null }} size={128} />
                    {isGroupAdmin && isCustomGroup && (
                      <button className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center text-white">
                        <Camera className="w-8 h-8" />
                      </button>
                    )}
                  </div>
                  <div className="w-full max-w-sm">
                    {isGroupAdmin && isCustomGroup ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="input input-bordered input-ghost text-center text-xl font-bold focus:bg-base-200"
                        />
                        {editingName !== roomName && (
                          <button 
                            className="btn btn-primary btn-xs self-center" 
                            onClick={handleRename}
                            disabled={isSaving}
                          >
                            {isSaving ? "Saving..." : "Save Name"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <h2 className="text-2xl font-bold">{roomName}</h2>
                    )}
                    <p className="text-sm text-base-content/60 capitalize mt-1">{roomType.replace(/_/g, " ")}</p>
                  </div>
                </div>

                <div className="divider">Actions</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {isCustomGroup && (
                    <button className="btn btn-outline btn-error gap-2 flex-1" onClick={handleLeave}>
                      <LogOut className="w-4 h-4" />
                      Leave Group
                    </button>
                  )}
                  {isGroupAdmin && isCustomGroup && (
                    <button className="btn btn-error gap-2 flex-1" onClick={onDeleteGroup}>
                      <Trash2 className="w-4 h-4" />
                      Delete for Everyone
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "members" && (
              <motion.div
                key="members"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm uppercase tracking-wider text-base-content/50">
                    Members ({members.length})
                  </h4>
                  {isGroupAdmin && isCustomGroup && (
                    <button className="btn btn-primary btn-xs gap-1">
                      <UserPlus className="w-3 h-3" /> Add
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {members.map((m) => (
                    <div 
                      key={m.userId} 
                      className={`flex items-center justify-between p-2 rounded-xl transition-colors group ${
                        m.userId !== currentUser.id ? "cursor-pointer hover:bg-base-200" : ""
                      }`}
                      onClick={() => m.userId !== currentUser.id && handleOpenDM(m.userId)}
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar user={m.user} size={48} />
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {m.user.name}
                            {m.isGroupAdmin && <span className="badge badge-primary badge-xs">Admin</span>}
                          </p>
                          <p className="text-xs text-base-content/50 capitalize">{m.user.role.toLowerCase()}</p>
                        </div>
                      </div>
                      {isGroupAdmin && m.userId !== currentUser.id && isCustomGroup && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="btn btn-ghost btn-xs text-error">Remove</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "media" && (
              <motion.div
                key="media"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {loading ? (
                  <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg text-primary" /></div>
                ) : media.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-base-content/30">
                    <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
                    <p>No media found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {media.map((item) => (
                      <div key={item.id} className="aspect-square relative group cursor-pointer overflow-hidden rounded-lg bg-base-300">
                        {item.mediaType === "image" ? (
                          <img 
                            src={`/api/storage/signed-url?path=${encodeURIComponent(item.mediaUrl)}`} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                            alt="media"
                            onClick={() => setEnlargedImage(item.mediaUrl)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-base-300 text-base-content/40">
                            {item.mediaType === "video" ? <Play className="w-8 h-8" /> : <ImageIcon className="w-8 h-8" />}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "links" && (
              <motion.div
                key="links"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {loading ? (
                  <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg text-primary" /></div>
                ) : links.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-base-content/30">
                    <LinkIcon className="w-12 h-12 mb-4 opacity-20" />
                    <p>No links found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {links.map((link, i) => (
                      <a 
                        key={i} 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl bg-base-200 hover:bg-base-300 transition-colors border border-base-300 group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                          <LinkIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary truncate group-hover:underline">{link.url}</p>
                          <p className="text-[10px] text-base-content/40 mt-0.5">
                            Shared by {link.sender.name} • {dayjs(link.createdAt).format("MMM D, YYYY")}
                          </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-base-content/20 group-hover:text-base-content/60" />
                      </a>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "recordings" && (
              <motion.div
                key="recordings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {loading ? (
                  <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg text-primary" /></div>
                ) : recordings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-base-content/30">
                    <Mic className="w-12 h-12 mb-4 opacity-20" />
                    <p>No recordings found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recordings.map((rec) => (
                      <div key={rec.id} className="p-3 rounded-xl bg-base-200 border border-base-300 flex items-center justify-between group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                            <Mic className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{rec.title || "Meeting Recording"}</p>
                            <p className="text-[10px] text-base-content/40 flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {dayjs(rec.createdAt).format("MMM D")}</span>
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {rec.uploadedBy.name}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-sm btn-circle" title="Play"><Play className="w-4 h-4 text-primary" /></button>
                          <button className="btn btn-ghost btn-sm btn-circle" title="Download"><Download className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Enlarged Image Lightbox */}
      <AnimatePresence>
        {enlargedImage && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4" onClick={() => setEnlargedImage(null)}>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={`/api/storage/signed-url?path=${encodeURIComponent(enlargedImage)}`} 
              className="max-w-full max-h-full rounded-lg shadow-2xl" 
              alt="enlarged"
            />
            <button className="absolute top-4 right-4 btn btn-circle btn-ghost text-white"><X className="w-6 h-6" /></button>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

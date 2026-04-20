"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Room,
  RoomEvent,
  VideoPresets,
  ConnectionState,
} from "livekit-client";
import {
  LiveKitRoom,
  VideoConference,
  useLocalParticipant,
  RoomAudioRenderer,
  ControlBar,
  ParticipantTile,
} from "@livekit/components-react";
import "@livekit/components-styles";
import {
  PhoneOff,
  UserPlus,
  X,
  Copy,
  Check,
  Search,
  Settings,
  Users,
  Circle,
  Square,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import MeetingPreJoin from "./MeetingPreJoin";
import { useTheme } from "@/components/providers/ThemeProvider";

interface LiveKitMeetingProps {
  meetingId?: string;
  projectId?: string;
  url: string;
  roomName: string;
  token: string | null;
  title: string;
  displayName?: string | null;
  email?: string | null;
  isGuest?: boolean;
  isModerator: boolean;
  canInviteUsers: boolean;
  canInviteClients: boolean;
  skipPrejoin?: boolean;
  initialMicOn?: boolean;
  initialVideoOn?: boolean;
  onClose: () => void;
}

interface SearchUser {
  id: string;
  name: string;
  role: string;
  profilePicUrl: string | null;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function LiveKitMeeting({
  meetingId,
  projectId,
  url,
  roomName,
  token,
  title,
  displayName,
  email,
  isGuest,
  isModerator,
  canInviteUsers,
  canInviteClients,
  skipPrejoin,
  initialMicOn = true,
  initialVideoOn = true,
  onClose,
}: LiveKitMeetingProps) {
  const [prejoin, setPrejoin] = useState(!skipPrejoin);
  const [micOn, setMicOn] = useState(initialMicOn);
  const [videoOn, setVideoOn] = useState(initialVideoOn);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [projectInviteList, setProjectInviteList] = useState<SearchUser[]>([]);
  const [inviteResults, setInviteResults] = useState<SearchUser[]>([]);
  const [projectInviteLoading, setProjectInviteLoading] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [participantsInMeeting, setParticipantsInMeeting] = useState<SearchUser[]>([]);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - (recordingStartTime || Date.now())) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  const stopRecording = useCallback(() => {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setIsRecording(false);
    setRecorder(null);
    setRecordingStartTime(null);
    setRecordingDuration(0);
  }, [recorder]);

  const startRecording = async () => {
    try {
      // Capture the current tab
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
      } as any);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9,opus",
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Create download link
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Meeting_Recording_${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        
        toast.success("Recording saved to Downloads", {
          icon: "💾",
          style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" },
        });
      };

      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      
      toast.success("Recording started. Please ensure you are sharing this tab.", {
        icon: "⏺️",
        style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" },
      });
    } catch (err) {
      console.error("Failed to start recording:", err);
      toast.error("Recording failed. Make sure to allow screen capture.");
    }
  };

  const syncPresence = useCallback(async (method: "POST" | "DELETE") => {
    if (!meetingId) return;
    try {
      await fetch(`/api/meetings/${meetingId}/presence`, { method, cache: "no-store" });
    } catch {}
  }, [meetingId]);

  useEffect(() => {
    if (!prejoin) {
      void syncPresence("POST");
    }
    return () => {
      if (!prejoin) void syncPresence("DELETE");
    };
  }, [prejoin, syncPresence]);

  const fetchParticipants = useCallback(async () => {
    if (!meetingId) return;
    try {
      const res = await fetch(`/api/meetings/${meetingId}/participants`);
      if (!res.ok) return setParticipantsInMeeting([]);
      const data = await res.json();
      setParticipantsInMeeting(data.data ?? []);
    } catch {
      setParticipantsInMeeting([]);
    }
  }, [meetingId]);

  const copyLink = () => {
    const url = `${window.location.origin}/join/meeting/${meetingId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Meeting link copied", {
      style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" },
    });
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!inviteModalOpen || !projectId) return;
    setProjectInviteLoading(true);

    Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      meetingId
        ? fetch(`/api/meetings/${meetingId}/participants`).then((r) => r.json()).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
    ])
      .then(([projData, partsData]: any) => {
        const members = (projData.data?.members ?? []).map((m: any) => m.user).filter(Boolean) as SearchUser[];
        const byId = new Map<string, SearchUser>();
        for (const u of members) {
          if (u.role === "SUPER_ADMIN") continue;
          if (u.role === "CLIENT") {
            if (!canInviteClients) continue;
          } else if (!canInviteUsers) {
            continue;
          }
          byId.set(u.id, { ...u, profilePicUrl: u.profilePicUrl ?? null });
        }
        if (projData.data?.client && canInviteClients) {
          const c = projData.data.client;
          byId.set(c.id, {
            id: c.id,
            name: `${c.name} (client)`,
            role: "CLIENT",
            profilePicUrl: c.profilePicUrl ?? null,
          });
        }

        const activeParticipantIds = new Set((partsData.data ?? []).map((p: any) => p.id));
        const filtered = Array.from(byId.values()).filter((u) => !activeParticipantIds.has(u.id));
        setProjectInviteList(filtered);
      })
      .catch(() => setProjectInviteList([]))
      .finally(() => setProjectInviteLoading(false));
  }, [inviteModalOpen, projectId, canInviteClients, canInviteUsers, meetingId]);

  useEffect(() => {
    if (!inviteModalOpen || projectId) return;
    const timer = setTimeout(() => {
      Promise.all([
        fetch(`/api/users${inviteQuery ? `?q=${encodeURIComponent(inviteQuery)}` : ""}`).then((r) => r.json()),
        meetingId ? fetch(`/api/meetings/${meetingId}/participants`).then((r) => r.json()).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ])
        .then(([usersRes, partsRes]: any) => {
          const activeParticipantIds = new Set((partsRes.data ?? []).map((p: any) => p.id));
          setInviteResults((usersRes.data || []).filter((u: SearchUser) => {
            if (u.role === "SUPER_ADMIN") return false;
            if (activeParticipantIds.has(u.id)) return false;
            if (u.role === "CLIENT") return canInviteClients;
            return canInviteUsers;
          }));
        })
        .catch(() => setInviteResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [inviteQuery, inviteModalOpen, canInviteClients, canInviteUsers, projectId, meetingId]);

  if (prejoin) {
    return (
      <MeetingPreJoin
        roomName={roomName}
        onJoin={({ audio, video }) => {
          setMicOn(audio);
          setVideoOn(video);
          setPrejoin(false);
        }}
        onCancel={onClose}
      />
    );
  }

  if (!token || !url) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black overflow-hidden">
      <LiveKitRoom
        video={videoOn}
        audio={micOn}
        token={token}
        serverUrl={url}
        data-theme="dark"
        connect={true}
        onDisconnected={onClose}
        className="flex-1 min-h-0 flex flex-col"
      >
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
          <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
            <h2 className="text-white font-semibold text-sm truncate max-w-[200px]">{title}</h2>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* Participants Dropdown */}
          <div className="dropdown dropdown-end">
            <button 
              className="btn btn-circle btn-sm bg-black/50 border-white/10 hover:bg-white/20"
              onClick={() => void fetchParticipants()}
            >
              <Users className="w-4 h-4 text-white" />
            </button>
            <ul className="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-56 mt-2 border border-base-300">
              {participantsInMeeting.length === 0 ? (
                <li className="p-2 text-sm opacity-60">No participants info</li>
              ) : (
                participantsInMeeting.map((p) => (
                  <li key={p.id} className="p-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs truncate">{p.name}</span>
                      <span className="text-[10px] opacity-50">{p.role}</span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Recording Button */}
          <button 
            className={`btn btn-sm gap-2 rounded-xl border-white/10 shadow-lg ${
              isRecording ? "btn-error animate-pulse" : "bg-black/50 hover:bg-white/20 text-white"
            }`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>{formatDuration(recordingDuration)}</span>
              </>
            ) : (
              <>
                <Circle className="w-4 h-4 fill-current text-error" />
                <span className="hidden sm:inline">Record</span>
              </>
            )}
          </button>

          {/* Invite Button */}
          {canInviteUsers && (
            <button 
              className="btn btn-sm btn-primary rounded-xl gap-2 shadow-lg"
              onClick={() => setInviteModalOpen(true)}
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Invite</span>
            </button>
          )}

          {/* Copy Link */}
          <button 
            className="btn btn-circle btn-sm bg-black/50 border-white/10 hover:bg-white/20"
            onClick={copyLink}
            title="Copy join link"
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-white" />}
          </button>

          {/* Close Button */}
          <button 
            className="btn btn-circle btn-sm btn-error"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box bg-base-200 border border-base-300 max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">
                {projectId ? "Invite from project" : "Invite participants"}
              </h3>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setInviteModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
              <input
                className="input input-bordered w-full pl-10 bg-base-100"
                placeholder={projectId ? "Filter by name…" : "Search team…"}
                value={inviteQuery}
                onChange={(e) => setInviteQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {(projectId ? projectInviteList : inviteResults).filter(u => !inviteQuery.trim() || u.name.toLowerCase().includes(inviteQuery.toLowerCase())).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-2 bg-base-100 rounded-lg border border-base-300/50"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{u.name}</span>
                    <span className="text-[10px] opacity-50 uppercase tracking-wider">{u.role}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-xs btn-primary shrink-0"
                    disabled={invitingUserId === u.id}
                    onClick={async () => {
                      setInvitingUserId(u.id);
                      try {
                        const res = await fetch(`/api/meetings/${meetingId}/invite`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ targetUserId: u.id }),
                        });
                        if (!res.ok) throw new Error();
                        toast.success(`Invited ${u.name}`);
                      } catch {
                        toast.error("Invite failed");
                      } finally {
                        setInvitingUserId(null);
                      }
                    }}
                  >
                    Invite
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setInviteModalOpen(false)} />
        </div>
      )}
    </div>
  );
}

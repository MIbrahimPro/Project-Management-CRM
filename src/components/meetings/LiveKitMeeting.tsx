"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Room,
  ConnectOptions,
  RoomEvent,
  LocalTrackPublication,
  RemoteTrackPublication,
  StreamState,
  AudioStreamTrack,
  VideoStreamTrack,
  type VideoPresets,
} from "livekit-client";
import { LiveKitRoom, useLiveKitRoom, VideoTrack, AudioTrack } from "@livekit/react";
import {
  PhoneOff,
  Radio,
  Search,
  UserPlus,
  X,
  Copy,
  Check,
  MessageSquare,
  MonitorUp,
  Hand,
  Users,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MoreVertical,
  Settings,
} from "lucide-react";
import toast from "react-hot-toast";
import MeetingPreJoin from "./MeetingPreJoin";
import { useTheme } from "@/components/providers/ThemeProvider";

interface LiveKitMeetingProps {
  meetingId?: string;
  /** When set, invite modal lists project members (+ client for managers) and copy-link uses the project join URL. */
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
  const { theme } = useTheme();
  const [api, setApi] = useState<Room | null>(null);
  const [prejoin, setPrejoin] = useState(!skipPrejoin);
  const [micOn, setMicOn] = useState(initialMicOn);
  const [videoOn, setVideoOn] = useState(initialVideoOn);
  const [hasJoined, setHasJoined] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<SearchUser[]>([]);
  const [projectInviteList, setProjectInviteList] = useState<SearchUser[]>([]);
  const [participantsInMeeting, setParticipantsInMeeting] = useState<SearchUser[]>([]);
  const [projectInviteLoading, setProjectInviteLoading] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [lobbyUsers, setLobbyUsers] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);

  // Sync theme colors from DaisyUI to LiveKit
  const themeColors = useMemo(() => {
    if (typeof window === "undefined") return {};
    const style = getComputedStyle(document.documentElement);
    return {
      primary: `hsl(${style.getPropertyValue("--p").trim()})`,
      base100: `hsl(${style.getPropertyValue("--b1").trim()})`,
      base200: `hsl(${style.getPropertyValue("--b2").trim()})`,
      base300: `hsl(${style.getPropertyValue("--b3").trim()})`,
      baseContent: `hsl(${style.getPropertyValue("--bc").trim()})`,
    };
  }, []);

  const participantDisplayName = displayName || (isGuest ? "Guest" : "Anonymous");

  const syncPresence = useCallback(async (method: "POST" | "DELETE") => {
    if (!meetingId) return;
    try {
      await fetch(`/api/meetings/${meetingId}/presence`, { method, cache: "no-store" });
    } catch {}
  }, [meetingId]);

  // Device enumeration
  useEffect(() => {
    if (typeof window === "undefined") return;

    const enumerateDevices = async () => {
      try {
        await navigator.mediaDevices.enumerateDevices();
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAvailableDevices(devices.filter((d) => d.kind === "audioinput" || d.kind === "videoinput"));
      } catch (err) {
        console.error("Failed to enumerate devices:", err);
      }
    };
    enumerateDevices();
  }, []);

  // Handle room connection
  useEffect(() => {
    if (!token || !url || hasJoined) return;

    const connectToRoom = async () => {
      try {
        const options: ConnectOptions = {
          autoConnect: true,
          audio: micOn,
          video: videoOn ? { width: { ideal: 1280, height: 720 } } : false,
        };

        const room = new Room(options);
        setApi(room);

        room.on(RoomEvent.Connected, () => {
          setHasJoined(true);
          void syncPresence("POST");
          toast.success("Connected to meeting");
        });

        room.on(RoomEvent.Disconnected, () => {
          setHasJoined(false);
          void syncPresence("DELETE");
          onClose();
        });

        room.on(RoomEvent.ParticipantConnected, (participant) => {
          toast(`${participant.identity} joined the meeting`, {
            icon: "👋",
            style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" },
          });
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          toast(`${participant.identity} left the meeting`, {
            icon: "👋",
            style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" },
          });
        });

        room.on(RoomEvent.LocalTrackPublished, (publication) => {
          if (publication.track instanceof AudioStreamTrack) {
            setMicOn(true);
          }
          if (publication.track instanceof VideoStreamTrack) {
            setVideoOn(true);
          }
        });

        room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
          if (publication.track instanceof AudioStreamTrack) {
            setMicOn(false);
          }
          if (publication.track instanceof VideoStreamTrack) {
            setVideoOn(false);
          }
        });

        room.on(RoomEvent.RecordingStatusChanged, (data) => {
          console.log("[LiveKit] Recording status changed:", data);
          if (data.isRecording) {
            toast.success("Recording started", {
              style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" },
            });
            setIsRecording(true);
          } else {
            toast("Recording stopped", {
              icon: "⏺️",
              style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" },
            });
            setIsRecording(false);
            setRecordingStartTime(null);
          }
        });

        // Connect with token
        await room.connect(url, token);
      } catch (err) {
        console.error("Failed to connect to room:", err);
        toast.error("Failed to connect to meeting");
      }
    };

    void connectToRoom();

    return () => {
      if (api) {
        api.off(RoomEvent.Connected);
        api.off(RoomEvent.Disconnected);
        api.off(RoomEvent.ParticipantConnected);
        api.off(RoomEvent.ParticipantDisconnected);
        api.off(RoomEvent.LocalTrackPublished);
        api.off(RoomEvent.LocalTrackUnpublished);
        api.off(RoomEvent.RecordingStatusChanged);
      }
    };
  }, [token, url, hasJoined, syncPresence, onClose]);

  // Disconnect when component unmounts or room closes
  useEffect(() => {
    return () => {
      if (api) {
        void api.disconnect();
      }
    };
  }, [api]);

  // Methods to control the room
  const toggleAudio = useCallback(async () => {
    if (!api) return;
    try {
      const tracks = api.localTracks.filter((t) => t.kind === "audio");
      for (const track of tracks) {
        await track.enable(!micOn);
      }
      setMicOn(!micOn);
    } catch (err) {
      console.error("Failed to toggle audio:", err);
    }
  }, [api, micOn]);

  const toggleVideo = useCallback(async () => {
    if (!api) return;
    try {
      const tracks = api.localTracks.filter((t) => t.kind === "video");
      for (const track of tracks) {
        if (track.isEnabled) {
          await track.disable();
        } else {
          await track.enable();
        }
      }
      setVideoOn(!videoOn);
    } catch (err) {
      console.error("Failed to toggle video:", err);
    }
  }, [api, videoOn]);

  const toggleScreenShare = useCallback(async () => {
    if (!api) return;
    try {
      const tracks = api.localTracks.filter((t) => t.kind === "video" && t.source === "screen");
      if (tracks.length > 0) {
        // Already sharing, stop
        await api.disconnect();
        setHasJoined(false);
        // Reconnect without screen share
        await new Promise((resolve) => setTimeout(resolve, 100));
        // Reconnect logic would go here
      } else {
        // Share screen
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: true,
        });
        const screenTrack = await api.createScreenTrack(screenStream);
        await api.localParticipant.publishTrack(screenTrack);
      }
    } catch (err) {
      console.error("Failed to toggle screen share:", err);
    }
  }, [api]);

  const toggleRaiseHand = useCallback(async () => {
    if (!api) return;
    // LiveKit has participant signals for raise hand
    // For now, show toast
    toast("Hand raised!", {
      icon: "👋",
      style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" },
    });
  }, [api]);

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

  const toggleRecording = async () => {
    if (isRecording) {
      if (recorder) {
        recorder.stop();
        recorder.stream.getTracks().forEach((t) => t.stop());
      }
      setIsRecording(false);
      setRecordingStartTime(null);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
      });

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const file = new File([blob], `recording-${meetingId}-${Date.now()}.webm`, { type: "video/webm" });

        const toastId = toast.loading("Uploading recording...", {
          style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" },
        });

        try {
          // 1. Upload file
          const formData = new FormData();
          formData.append("file", file);
          formData.append("type", "video");
          const uploadRes = await fetch("/api/chat/upload", { method: "POST", body: formData });
          const uploadData = await uploadRes.json();
          if (!uploadRes.ok) throw new Error();

          // 2. Save recording record
          await fetch(`/api/meetings/${meetingId}/recording`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blobPath: uploadData.data.path,
              title: `Recording - ${new Date().toLocaleString()}`,
            }),
          });

          toast.success("Recording saved", { id: toastId });
        } catch {
          toast.error("Failed to save recording", { id: toastId });
        }
      };

      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      toast.success("Recording started. Please keep the shared tab visible.", {
        style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" },
      });
    } catch (err) {
      console.error("Recording error:", err);
      toast.error("Could not start recording. Permission denied.");
    }
  };

  const copyLink = () => {
    // Public join URL is preferable for sharing — it supports guest join flow
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

    // Fetch project members and active meeting participants concurrently,
    // then filter out people already present in the meeting.
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
          // If we have a meetingId, open the public join page in a new tab so
          // the user lands directly in the meeting (avoids nested prejoin pages).
          if (meetingId) {
            const publicUrl = `${window.location.origin}/join/meeting/${meetingId}`;
            try {
              window.open(publicUrl, "_blank", "noopener");
            } catch (e) {
              // fallback: navigate in-place
              window.location.href = publicUrl;
            }
            onClose();
            return;
          }

          setMicOn(audio);
          setVideoOn(video);
          setPrejoin(false);
        }}
        onCancel={onClose}
      />
    );
  }

  const inviteRows = projectId
    ? projectInviteList.filter(
        (u) =>
          !inviteQuery.trim() ||
          u.name.toLowerCase().includes(inviteQuery.trim().toLowerCase()),
      )
    : inviteResults;

  // Render LiveKit room or loading state
  if (!api) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="spinner spinner-lg spinner-primary mb-4" />
          <p className="text-white">Connecting to meeting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex-1 min-h-0 relative">
        <LiveKitRoom
          url={url}
          token={token}
          audio={micOn}
          video={videoOn ? { width: { ideal: 1280, height: 720 } } : false}
          options={{
            audioCaptureDefaults: {
              deviceLabel: micOn ? "Default Microphone" : undefined,
            },
            videoCaptureDefaults: {
              deviceLabel: videoOn ? "Default Camera" : undefined,
              resolution: "hd",
            },
          }}
        >
          {/* Main Video Area - Shows active speaker or shared screen */}
          <div className="absolute inset-0 flex items-center justify-center bg-base-100">
            {/* Use participant video tracks */}
            {api.localParticipant && (
              <div className="absolute bottom-4 right-4 z-10">
                <LocalParticipantVideo />
              </div>
            )}
          </div>

          {/* Recording indicator for moderators */}
          {isModerator && isRecording && (
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full">
              <div className="w-3 h-3 bg-white animate-pulse rounded-full" />
              <span className="font-medium">Recording</span>
              <span className="text-sm opacity-80">
                {Math.floor((Date.now() - (recordingStartTime || Date.now())) / 60000)}m{" "}
                {Math.floor(((Date.now() - (recordingStartTime || Date.now())) % 60000) / 1000)}s
              </span>
            </div>
          )}

          {/* Meeting title overlay */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur px-4 py-1 rounded-full">
            <h2 className="text-white font-medium truncate max-w-md">{title}</h2>
          </div>
        </LiveKitRoom>
      </div>

      {hasJoined && (
        <div className="flex-shrink-0 z-20 border-t border-base-content/10 bg-base-300/95 backdrop-blur-md px-2 py-2">
          <div className="flex flex-wrap items-center justify-center gap-1 max-w-5xl mx-auto">
            {/* Audio Controls */}
            <button
              type="button"
              className={`btn btn-sm gap-1 ${micOn ? "btn-ghost" : "btn-error"}`}
              title="Microphone"
              onClick={toggleAudio}
            >
              {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            {/* Video Controls */}
            <button
              type="button"
              className={`btn btn-sm gap-1 ${videoOn ? "btn-ghost" : "btn-error"}`}
              title="Camera"
              onClick={toggleVideo}
            >
              {videoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>

            {/* Screen Share */}
            <button
              type="button"
              className="btn btn-sm btn-ghost gap-1"
              title="Share screen"
              onClick={toggleScreenShare}
            >
              <MonitorUp className="w-4 h-4" />
            </button>

            {/* Raise Hand */}
            <button
              type="button"
              className="btn btn-sm btn-ghost gap-1"
              title="Raise hand"
              onClick={toggleRaiseHand}
            >
              <Hand className="w-4 h-4" />
            </button>

            {/* Chat Toggle */}
            <button
              type="button"
              className="btn btn-sm btn-ghost gap-1"
              title="Chat"
              onClick={() => toast.info("Chat feature coming soon", { icon: "💬" })}
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {/* Participants List */}
            <div className="dropdown dropdown-top">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-sm btn-ghost gap-1"
                onClick={() => void fetchParticipants()}
              >
                <Users className="w-4 h-4" />
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-56 mb-1 border border-base-300"
              >
                {participantsInMeeting.length === 0 ? (
                  <li className="p-2 text-sm opacity-60">No participants</li>
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

            {/* Invite Button */}
            {canInviteUsers && (
              <button
                type="button"
                className="btn btn-sm btn-primary btn-outline gap-1"
                title={projectId ? "Invite from project" : "Invite"}
                onClick={() => setInviteModalOpen(true)}
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Invite</span>
              </button>
            )}

            {/* Copy Link */}
            <button
              type="button"
              className="btn btn-sm btn-ghost gap-1"
              title="Copy join link"
              onClick={copyLink}
            >
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Recording Toggle (Moderator only) */}
            {isModerator && (
              <button
                type="button"
                className={`btn btn-sm gap-1 ${isRecording ? "btn-error animate-pulse" : "btn-ghost"}`}
                title="Local recording"
                onClick={() => void toggleRecording()}
              >
                <span className="text-xs">{isRecording ? "Stop rec" : "Record"}</span>
              </button>
            )}

            {/* Settings Button */}
            <button
              type="button"
              className="btn btn-sm btn-ghost gap-1"
              title="Settings"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Leave Button */}
            <button
              type="button"
              className="btn btn-sm btn-error gap-1"
              title="Leave meeting"
              onClick={() => {
                void api.disconnect();
                onClose();
              }}
            >
              <PhoneOff className="w-4 h-4" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>
      )}

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
              {projectId && projectInviteLoading ? (
                <p className="text-center py-6 text-sm opacity-60">Loading project members…</p>
              ) : (
                inviteRows.map((u) => (
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
                          toast.success(`Invited ${u.name}`, {
                            style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" },
                          });
                        } catch {
                          toast.error("Invite failed", {
                            style: { background: "hsl(var(--b2))", color: "hsl(var(--er))" },
                          });
                        } finally {
                          setInvitingUserId(null);
                        }
                      }}
                    >
                      Invite
                    </button>
                  </div>
                ))
              )}
              {!projectInviteLoading && inviteRows.length === 0 && (
                <p className="text-center py-4 text-sm opacity-50">
                  {projectId ? "No one to invite." : inviteQuery ? "No users found." : "Type to search."}
                </p>
              )}
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setInviteModalOpen(false)} />
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal modal-open">
          <div className="modal-box bg-base-200 border border-base-300 max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Settings</h3>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setShowSettings(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Audio Device Selection */}
            <div className="space-y-3">
              <div>
                <label className="label text-xs font-semibold">
                  <Mic className="w-3.5 h-3.5 inline mr-2" />
                  Microphone
                </label>
                <select
                  className="select select-bordered w-full bg-base-100"
                  onChange={(e) => console.log("Audio device changed:", e.target.value)}
                  defaultValue="default"
                >
                  <option value="default">Default Device</option>
                  {availableDevices
                    .filter((d) => d.kind === "audioinput")
                    .map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Microphone ${d.deviceId.slice(0, 8)}...`}
                      </option>
                    ))}
                </select>
              </div>

              {/* Video Device Selection */}
              <div>
                <label className="label text-xs font-semibold">
                  <Video className="w-3.5 h-3.5 inline mr-2" />
                  Camera
                </label>
                <select
                  className="select select-bordered w-full bg-base-100"
                  onChange={(e) => console.log("Video device changed:", e.target.value)}
                  defaultValue="default"
                >
                  <option value="default">Default Device</option>
                  {availableDevices
                    .filter((d) => d.kind === "videoinput")
                    .map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(0, 8)}...`}
                      </option>
                    ))}
                </select>
              </div>

              {/* Audio Test */}
              <div className="flex items-center justify-between p-3 bg-base-100 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Test Microphone</p>
                  <p className="text-xs text-base-content/60">Verify your microphone is working</p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    toast.info("Audio test: speak now...", { icon: "🎤" });
                  }}
                >
                  Test
                </button>
              </div>
            </div>

            <div className="mt-6">
              <button
                className="btn btn-error btn-sm w-full"
                onClick={() => {
                  setShowSettings(false);
                  void api?.disconnect();
                }}
              >
                Disconnect and Close
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowSettings(false)} />
        </div>
      )}
    </div>
  );
}

// Local participant video component
function LocalParticipantVideo() {
  const [localVideoRef, setLocalVideoRef] = useState<HTMLVideoElement | null>(null);

  return (
    <div className="relative rounded-lg overflow-hidden border-2 border-primary">
      <video ref={setLocalVideoRef} autoPlay playsInline muted />
    </div>
  );
}

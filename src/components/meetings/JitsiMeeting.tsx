import { useCallback, useEffect, useState, useMemo } from "react";
import { JitsiMeeting as JitsiSDK } from "@jitsi/react-sdk";
import { PhoneOff, Radio, Search, UserPlus, X, Mic, MicOff, Video, VideoOff, Copy, Check } from "lucide-react";
import toast from "react-hot-toast";
import MeetingPreJoin from "./MeetingPreJoin";
import { useTheme } from "@/components/providers/ThemeProvider";

interface JitsiMeetingProps {
  meetingId?: string;
  domain: string;
  serverUrl?: string;
  roomName: string;
  title: string;
  token?: string | null;
  displayName?: string | null;
  email?: string | null;
  isGuest?: boolean;
  isModerator: boolean;
  canInviteUsers: boolean;
  canInviteClients: boolean;
  onClose: () => void;
}

interface SearchUser {
  id: string;
  name: string;
  role: string;
  profilePicUrl: string | null;
}

export default function JitsiMeeting({
  meetingId,
  domain,
  serverUrl,
  roomName,
  title,
  token,
  displayName,
  email,
  isGuest,
  isModerator,
  canInviteUsers,
  canInviteClients,
  onClose,
}: JitsiMeetingProps) {
  const { theme } = useTheme();
  const [api, setApi] = useState<any>(null);
  const [prejoin, setPrejoin] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<SearchUser[]>([]);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [lobbyUsers, setLobbyUsers] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);

  // Sync theme colors from DaisyUI to Jitsi
  const themeColors = useMemo(() => {
    if (typeof window === "undefined") return {};
    const style = getComputedStyle(document.documentElement);
    return {
      primary: `hsl(${style.getPropertyValue("--p").trim()})`,
      base100: `hsl(${style.getPropertyValue("--b1").trim()})`,
      base200: `hsl(${style.getPropertyValue("--b2").trim()})`,
      baseContent: `hsl(${style.getPropertyValue("--bc").trim()})`,
    };
  }, [theme]);

  const participantDisplayName = displayName || (isGuest ? "Guest" : "Anonymous");

  const syncPresence = useCallback(async (method: "POST" | "DELETE") => {
    if (!meetingId) return;
    try {
      await fetch(`/api/meetings/${meetingId}/presence`, { method, cache: "no-store" });
    } catch {}
  }, [meetingId]);

  const handleApiReady = (jitsiApi: any) => {
    setApi(jitsiApi);

    jitsiApi.addListener("videoConferenceJoined", () => {
      setHasJoined(true);
      void syncPresence("POST");
      if (isModerator) {
        // Auto-enable lobby for moderators
        jitsiApi.executeCommand("toggleLobby", true);
      }
      // Set meeting subject
      jitsiApi.executeCommand("subject", title || "DevRolin Meeting");
    });

    jitsiApi.addListener("recordingStatusChanged", (data: any) => {
      console.log("[Jitsi] Recording status changed:", data);
      if (data.on) {
        toast.success("Recording started", { 
          style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" }
        });
      } else {
        toast("Recording stopped", { 
          icon: "⏺️",
          style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" }
        });
      }
    });

    jitsiApi.addListener("videoConferenceLeft", () => {
      setHasJoined(false);
      void syncPresence("DELETE");
      onClose();
    });

    jitsiApi.addListener("readyToClose", () => {
      onClose();
    });

    jitsiApi.addListener("lobbyUserJoined", (user: any) => {
      if (isModerator) {
        setLobbyUsers(prev => [...prev, user]);
        toast(`Lobby: ${user.displayName} is waiting`, { 
          icon: "👋",
          style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" }
        });
      }
    });

    jitsiApi.addListener("lobbyUserLeft", (id: string) => {
      setLobbyUsers(prev => prev.filter(u => u.id !== id));
    });
  };

  const admitUser = (userId: string) => {
    if (api) {
      api.executeCommand("lobbyManageUser", userId, "allow");
      setLobbyUsers(prev => prev.filter(u => u.id !== userId));
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      if (recorder) {
        recorder.stop();
        recorder.stream.getTracks().forEach(t => t.stop());
      }
      setIsRecording(false);
      setRecordingStartTime(null);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true
      });

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const file = new File([blob], `recording-${meetingId}-${Date.now()}.webm`, { type: "video/webm" });
        
        const toastId = toast.loading("Uploading recording...", {
          style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" }
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
              title: `Recording - ${new Date().toLocaleString()}`
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
        style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" }
      });
    } catch (err) {
      console.error("Recording error:", err);
      toast.error("Could not start recording. Permission denied.");
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/join/meeting/${meetingId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Meeting link copied", {
      style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" }
    });
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!inviteModalOpen) return;
    const timer = setTimeout(() => {
      fetch(`/api/users${inviteQuery ? `?q=${encodeURIComponent(inviteQuery)}` : ""}`)
        .then(r => r.json())
        .then(d => {
          setInviteResults((d.data || []).filter((u: any) => {
            if (u.role === "SUPER_ADMIN") return false;
            if (u.role === "CLIENT") return canInviteClients;
            return canInviteUsers;
          }));
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [inviteQuery, inviteModalOpen, canInviteClients, canInviteUsers]);

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Custom Header/Toolbar for Lobby & Invites */}
      {hasJoined && (
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          {canInviteUsers && (
            <button className="btn btn-sm btn-glass gap-2" onClick={() => setInviteModalOpen(true)}>
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Invite Members</span>
              <span className="sm:hidden">Invite</span>
            </button>
          )}
          
          <button className="btn btn-sm btn-glass gap-2" onClick={copyLink}>
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">Copy Link</span>
          </button>

          {isModerator && (
            <button 
              className={`btn btn-sm gap-2 ${isRecording ? "btn-error animate-pulse" : "btn-glass"}`}
              onClick={toggleRecording}
            >
              <div className={`w-2 h-2 rounded-full ${isRecording ? "bg-white" : "bg-error"}`} />
              <span>{isRecording ? "Stop Recording" : "Record"}</span>
            </button>
          )}

          {isModerator && lobbyUsers.length > 0 && (
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-sm btn-warning gap-2">
                <Radio className="w-4 h-4 animate-pulse" />
                Lobby ({lobbyUsers.length})
              </div>
              <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52 mt-1 border border-base-300">
                {lobbyUsers.map(u => (
                  <li key={u.id}>
                    <div className="flex justify-between items-center p-2">
                      <span className="text-xs font-medium truncate flex-1">{u.displayName}</span>
                      <button className="btn btn-xs btn-primary" onClick={() => admitUser(u.id)}>Admit</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <JitsiSDK
        domain={domain}
        roomName={roomName}
        jwt={token || undefined}
        configOverwrite={{
          startWithAudioMuted: !micOn,
          startWithVideoMuted: !videoOn,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          enableWelcomePage: false,
          enableLobby: true,
          readOnlyName: true,
          defaultRemoteDisplayName: "Fellow Member",
          hideConferenceSubject: false,
          toolbarButtons: [
            "microphone", "camera", "desktop", "chat", "raisehand", 
            "fullscreen", "settings", "hangup", "recording", "tileview", "videoquality", "participants-pane"
          ],
        }}
        interfaceConfigOverwrite={{
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: themeColors.base100 || "#111111",
          TOOLBAR_BUTTONS_COLOR: themeColors.baseContent || "#eeeeee",
          CONTROL_BAR_BACKDROP_COLOR: themeColors.base200 || "#222222",
        }}
        userInfo={{ 
          displayName: participantDisplayName,
          email: email || "" 
        }}
        onApiReady={handleApiReady}
        getIFrameRef={ref => { 
          if (ref) {
            ref.style.height = "100%"; 
            ref.style.width = "100%";
          }
        }}
      />

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box bg-base-200 border border-base-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Invite Participants</h3>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setInviteModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
              <input
                className="input input-bordered w-full pl-10 bg-base-100"
                placeholder="Search team members..."
                value={inviteQuery}
                onChange={e => setInviteQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {inviteResults.map(u => (
                <div key={u.id} className="flex items-center justify-between p-2 bg-base-100 rounded-lg border border-base-300/50">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{u.name}</span>
                    <span className="text-[10px] opacity-50 uppercase tracking-wider">{u.role}</span>
                  </div>
                  <button 
                    className="btn btn-xs btn-primary" 
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
                          style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" }
                        });
                      } catch {
                        toast.error("Invite failed", {
                          style: { background: "hsl(var(--b2))", color: "hsl(var(--er))" }
                        });
                      } finally {
                        setInvitingUserId(null);
                      }
                    }}
                  >
                    Invite
                  </button>
                </div>
              ))}
              {inviteResults.length === 0 && inviteQuery && (
                <p className="text-center py-4 text-sm opacity-50">No users found</p>
              )}
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setInviteModalOpen(false)} />
        </div>
      )}
    </div>
  );
}

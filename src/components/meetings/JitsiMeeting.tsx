"use client";

import { useCallback, useEffect, useState } from "react";
import { JitsiMeeting as JitsiSDK } from "@jitsi/react-sdk";
import { PhoneOff, Radio, Search, UserPlus, X, Mic, MicOff, Video, VideoOff } from "lucide-react";
import toast from "react-hot-toast";
import MeetingPreJoin from "./MeetingPreJoin";

interface JitsiMeetingProps {
  meetingId?: string;
  domain: string;
  serverUrl?: string;
  roomName: string;
  token?: string | null;
  displayName?: string | null;
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
  token,
  displayName,
  isGuest,
  isModerator,
  canInviteUsers,
  canInviteClients,
  onClose,
}: JitsiMeetingProps) {
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
        jitsiApi.executeCommand("toggleLobby", true);
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
        toast(`Lobby: ${user.displayName} is waiting`, { icon: "👋" });
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
      {(isModerator || canInviteUsers) && hasJoined && (
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          {canInviteUsers && (
            <button className="btn btn-sm btn-glass gap-2" onClick={() => setInviteModalOpen(true)}>
              <UserPlus className="w-4 h-4" />
              Invite
            </button>
          )}
          {isModerator && lobbyUsers.length > 0 && (
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-sm btn-warning gap-2">
                <Radio className="w-4 h-4 animate-pulse" />
                Lobby ({lobbyUsers.length})
              </div>
              <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52 mt-1">
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
          toolbarButtons: [
            "microphone", "camera", "desktop", "chat", "raisehand", 
            "fullscreen", "settings", "hangup", "recording"
          ],
        }}
        interfaceConfigOverwrite={{
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
        }}
        userInfo={{ 
          displayName: participantDisplayName,
          email: "" 
        }}
        onApiReady={handleApiReady}
        getIFrameRef={ref => { ref.style.height = "100%"; ref.style.width = "100%"; }}
      />

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box bg-base-200">
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
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {inviteResults.map(u => (
                <div key={u.id} className="flex items-center justify-between p-2 bg-base-100 rounded-lg">
                  <span className="text-sm font-medium">{u.name}</span>
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

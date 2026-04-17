"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link2, PhoneOff, Radio, Search, UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";

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

interface JitsiAPI {
  addListener: (event: string, handler: (payload?: unknown) => void) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  dispose: () => void;
}

interface SearchUser {
  id: string;
  name: string;
  role: string;
  profilePicUrl: string | null;
}

function splitHostAndPort(value: string): string {
  return value.replace(/^\[/, "").replace(/\]$/, "").split(":")[0] ?? value;
}

function isValidJitsiHost(host: string): boolean {
  const normalizedHost = splitHostAndPort(host.trim().toLowerCase());
  if (!normalizedHost) return false;
  if (normalizedHost === "localhost") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalizedHost)) return true;
  if (normalizedHost.includes(".")) return true;
  if (normalizedHost.includes(":")) return true;
  return false;
}

function defaultProtocolForHost(host: string): "http" | "https" {
  return splitHostAndPort(host).toLowerCase() === "localhost" ? "http" : "https";
}

function buildJitsiSignalingUrls(serverUrl: URL): { bosh: string; websocket: string } {
  const basePath = serverUrl.pathname.replace(/\/+$/, "");
  const httpBase = `${serverUrl.origin}${basePath}`;
  const wsProtocol = serverUrl.protocol === "https:" ? "wss" : "ws";
  const wsBase = `${wsProtocol}://${serverUrl.host}${basePath}`;

  return {
    bosh: `${httpBase}/http-bind`,
    websocket: `${wsBase}/xmpp-websocket`,
  };
}

function parseJitsiEventName(payload: unknown, depth = 0): string | null {
  if (depth > 5 || payload == null) return null;

  if (typeof payload === "string") {
    try {
      return parseJitsiEventName(JSON.parse(payload) as unknown, depth + 1);
    } catch {
      return null;
    }
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = parseJitsiEventName(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof payload !== "object") return null;

  const eventObject = payload as Record<string, unknown>;
  const directCandidates = [eventObject.name, eventObject.event, eventObject.action, eventObject.type];
  for (const candidate of directCandidates) {
    if (typeof candidate === "string") return candidate;
  }

  for (const value of Object.values(eventObject)) {
    const found = parseJitsiEventName(value, depth + 1);
    if (found) return found;
  }

  return null;
}

function normalizeEventName(eventName: string): string {
  return eventName.toLowerCase().replace(/[^a-z]/g, "");
}

function extractToolbarButtonId(payload: unknown, depth = 0): string | null {
  if (depth > 5 || payload == null) return null;

  if (typeof payload === "string") {
    try {
      return extractToolbarButtonId(JSON.parse(payload) as unknown, depth + 1);
    } catch {
      return null;
    }
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = extractToolbarButtonId(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof payload !== "object") return null;

  const eventObject = payload as Record<string, unknown>;
  const candidates = [eventObject.key, eventObject.button, eventObject.id, eventObject.buttonId];
  for (const candidate of candidates) {
    if (typeof candidate === "string") return candidate;
  }

  for (const value of Object.values(eventObject)) {
    const found = extractToolbarButtonId(value, depth + 1);
    if (found) return found;
  }

  return null;
}

function createToolbarIconDataUri(svgInner: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${svgInner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const INVITE_TOOLBAR_BUTTON_ID = "crm-invite";
const ADD_PARTICIPANT_TOOLBAR_BUTTON_ID = "crm-add-participant";
const INVITE_TOOLBAR_ICON = createToolbarIconDataUri("<path d='M16 19h6'/><path d='M19 16v6'/><circle cx='9' cy='7' r='4'/><path d='M3 21c0-3.3 2.7-6 6-6h4'/>");
const ADD_PARTICIPANT_TOOLBAR_ICON = createToolbarIconDataUri("<path d='M8 12h8'/><path d='M12 8v8'/><circle cx='12' cy='12' r='9'/>");

function actionFromToolbarButtonId(buttonId: string | null): "invite" | "add-participant" | null {
  if (buttonId === INVITE_TOOLBAR_BUTTON_ID) return "invite";
  if (buttonId === ADD_PARTICIPANT_TOOLBAR_BUTTON_ID) return "add-participant";
  return null;
}

function detectToolbarAction(payload: unknown): "invite" | "add-participant" | null {
  try {
    const asText =
      typeof payload === "string"
        ? payload
        : JSON.stringify(payload);

    if (asText.includes(INVITE_TOOLBAR_BUTTON_ID)) return "invite";
    if (asText.includes(ADD_PARTICIPANT_TOOLBAR_BUTTON_ID)) return "add-participant";
    return null;
  } catch {
    return null;
  }
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (domain: string, options: Record<string, unknown>) => JitsiAPI;
  }
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
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiAPI | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [isIframeFallback, setIsIframeFallback] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResults, setInviteResults] = useState<SearchUser[]>([]);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [hasJoinedConference, setHasJoinedConference] = useState(false);
  const [meetingShareUrl, setMeetingShareUrl] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const joinedRef = useRef(false);
  const participantDisplayName =
    typeof displayName === "string" && displayName.trim().length > 0
      ? displayName.trim().slice(0, 48)
      : (isGuest ? "Guest" : "Anonymous");
  const customToolbarButtons = canInviteUsers
    ? [
        {
          id: INVITE_TOOLBAR_BUTTON_ID,
          text: "Invite",
          icon: INVITE_TOOLBAR_ICON,
        },
        {
          id: ADD_PARTICIPANT_TOOLBAR_BUTTON_ID,
          text: "Add participant",
          icon: ADD_PARTICIPANT_TOOLBAR_ICON,
        },
      ]
    : [];
  const notifyToolbarButtons = canInviteUsers
    ? [INVITE_TOOLBAR_BUTTON_ID, ADD_PARTICIPANT_TOOLBAR_BUTTON_ID]
    : [];

  const syncMeetingPresence = useCallback(
    async (method: "POST" | "DELETE") => {
      if (!meetingId) return;
      try {
        await fetch(`/api/meetings/${meetingId}/presence`, {
          method,
          credentials: "include",
          cache: "no-store",
        });
      } catch {
        // Best-effort presence sync only.
      }
    },
    [meetingId]
  );

  const handleConferenceJoined = useCallback(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    setHasJoinedConference(true);
    void syncMeetingPresence("POST");
  }, [syncMeetingPresence]);

  const handleConferenceLeft = useCallback(() => {
    if (!joinedRef.current) return;
    joinedRef.current = false;
    setHasJoinedConference(false);
    setInviteModalOpen(false);
    setLinkModalOpen(false);
    void syncMeetingPresence("DELETE");
  }, [syncMeetingPresence]);

  const openInviteModalFromToolbar = useCallback(() => {
    if (!joinedRef.current) {
      toast.error("Join the meeting first to invite participants");
      return;
    }
    setLinkModalOpen(false);
    setInviteModalOpen(true);
  }, []);

  const openLinkModalFromToolbar = useCallback(() => {
    if (!joinedRef.current) {
      toast.error("Join the meeting first to add participants");
      return;
    }
    setInviteModalOpen(false);
    setLinkModalOpen(true);
  }, []);

  const handleToolbarAction = useCallback(
    (action: "invite" | "add-participant") => {
      if (action === "invite") {
        openInviteModalFromToolbar();
        return;
      }
      openLinkModalFromToolbar();
    },
    [openInviteModalFromToolbar, openLinkModalFromToolbar]
  );

  const handleToolbarPayload = useCallback(
    (payload: unknown): boolean => {
      const toolbarAction = detectToolbarAction(payload);
      if (toolbarAction) {
        handleToolbarAction(toolbarAction);
        return true;
      }

      const clickedId = extractToolbarButtonId(payload);
      const mappedAction = actionFromToolbarButtonId(clickedId);
      if (!mappedAction) return false;

      handleToolbarAction(mappedAction);
      return true;
    },
    [handleToolbarAction]
  );

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (!meetingId) {
      setMeetingShareUrl("");
      return;
    }
    if (typeof window === "undefined") return;

    setMeetingShareUrl(`${window.location.origin}/join/meeting/${meetingId}`);
  }, [meetingId]);

  useEffect(() => {
    if (!meetingId) return;

    let cancelled = false;
    fetch(`/api/meetings/${meetingId}/presence`, { cache: "no-store" })
      .then(async (res) => {
        const payload = (await res.json()) as { data?: { joined?: boolean } };
        if (cancelled) return;
        const joined = Boolean(payload.data?.joined);
        joinedRef.current = joined;
        setHasJoinedConference(joined);
      })
      .catch(() => {
        if (cancelled) return;
        joinedRef.current = false;
        setHasJoinedConference(false);
      });

    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  useEffect(() => {
    if (!inviteModalOpen) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setInviteLoading(true);
      fetch(
        `/api/users${inviteQuery.trim() ? `?q=${encodeURIComponent(inviteQuery.trim())}` : ""}`,
        {
          cache: "no-store",
          signal: controller.signal,
        }
      )
        .then(async (res) => {
          const payload = (await res.json()) as { data?: SearchUser[]; error?: string };
          if (!res.ok) throw new Error(payload.error ?? "Failed to load users");
          setInviteResults(
            (payload.data ?? []).filter((candidate) => {
              if (candidate.role === "SUPER_ADMIN") return false;
              if (candidate.role === "CLIENT") return canInviteClients;
              return canInviteUsers;
            })
          );
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setInviteResults([]);
          toast.error("Could not load users");
        })
        .finally(() => {
          setInviteLoading(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [canInviteClients, canInviteUsers, inviteModalOpen, inviteQuery]);

  useEffect(() => {
    const rawDomain = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const normalizedDomain = isValidJitsiHost(rawDomain) ? rawDomain : "meet.jit.si";
    const normalizedServerUrl = (() => {
      if (!serverUrl) return `${defaultProtocolForHost(normalizedDomain)}://${normalizedDomain}`;
      const trimmed = serverUrl.trim();
      if (!trimmed) return `${defaultProtocolForHost(normalizedDomain)}://${normalizedDomain}`;

      try {
        const parsed = new URL(trimmed);
        if (!isValidJitsiHost(parsed.host)) {
          return `${defaultProtocolForHost(normalizedDomain)}://${normalizedDomain}`;
        }
        return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
      } catch {
        const withoutProtocol = trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
        const host = withoutProtocol.split("/")[0] ?? "";
        if (!isValidJitsiHost(host)) {
          return `${defaultProtocolForHost(normalizedDomain)}://${normalizedDomain}`;
        }
        return `${defaultProtocolForHost(host)}://${withoutProtocol}`;
      }
    })();

    const parsedServerUrl = new URL(normalizedServerUrl);
    const signaling = buildJitsiSignalingUrls(parsedServerUrl);
    const shouldUseIframeFallback = parsedServerUrl.protocol === "http:";
    const jitsiOrigin = parsedServerUrl.origin;
    const jitsiHost = parsedServerUrl.host;
    const toolbarButtons = [
      "microphone",
      "camera",
      "desktop",
      ...(canInviteUsers ? [INVITE_TOOLBAR_BUTTON_ID, ADD_PARTICIPANT_TOOLBAR_BUTTON_ID] : []),
      "chat",
      "fullscreen",
      "settings",
      ...(isModerator ? ["recording", "mute-everyone"] : []),
    ];

    if (shouldUseIframeFallback) {
      const baseRoomUrl = `${normalizedServerUrl.replace(/\/+$/, "")}/${encodeURIComponent(roomName)}`;
      const params = new URLSearchParams();
      if (token) params.set("jwt", token);

      const hashConfigParams = new URLSearchParams();
      hashConfigParams.set("config.prejoinPageEnabled", "false");
      hashConfigParams.set("config.disableDeepLinking", "true");
      hashConfigParams.set("config.enableWelcomePage", "false");
      hashConfigParams.set("config.bosh", JSON.stringify(signaling.bosh));
      hashConfigParams.set("config.toolbarButtons", JSON.stringify(toolbarButtons));
      hashConfigParams.set("config.disableInviteFunctions", "true");
      hashConfigParams.set("config.disableJoinLeaveNotifications", "true");
      hashConfigParams.set("config.defaultLocalDisplayName", JSON.stringify(participantDisplayName));
      hashConfigParams.set("config.defaultRemoteDisplayName", JSON.stringify(participantDisplayName));
      hashConfigParams.set("config.autoKnockLobby", "true");
      hashConfigParams.set("config.enableLobby", "true");
      hashConfigParams.set("config.lobby.autoKnock", "true");
      hashConfigParams.set("config.lobby.enabled", "true");
      if (canInviteUsers) {
        hashConfigParams.set("config.customToolbarButtons", JSON.stringify(customToolbarButtons));
        hashConfigParams.set("config.buttonsWithNotifyClick", JSON.stringify(notifyToolbarButtons));
      }
      hashConfigParams.set("interfaceConfig.SHOW_JITSI_WATERMARK", "false");
      hashConfigParams.set("interfaceConfig.SHOW_WATERMARK_FOR_GUESTS", "false");
      const hashConfig = hashConfigParams.toString();

      const query = params.toString();
      setIframeSrc(`${baseRoomUrl}${query ? `?${query}` : ""}#${hashConfig}`);
      setIsIframeFallback(true);

      const onIFrameMessage = (event: MessageEvent) => {
        let sameJitsiHost = false;
        try {
          sameJitsiHost = new URL(event.origin).host === jitsiHost;
        } catch {
          sameJitsiHost = false;
        }
        if (event.origin !== jitsiOrigin && !sameJitsiHost) return;

        if (handleToolbarPayload(event.data)) {
          return;
        }

        const eventName = parseJitsiEventName(event.data);
        if (!eventName) return;

        const normalizedEventName = normalizeEventName(eventName);
        if (normalizedEventName === "videoconferencejoined" || normalizedEventName === "conferencejoined") {
          handleConferenceJoined();
          return;
        }

        if (
          normalizedEventName === "videoconferenceleft" ||
          normalizedEventName === "conferenceleft" ||
          normalizedEventName === "readytoclose"
        ) {
          handleConferenceLeft();
        }
      };

      window.addEventListener("message", onIFrameMessage);

      return () => {
        window.removeEventListener("message", onIFrameMessage);
        handleConferenceLeft();
        if (apiRef.current) {
          try {
            apiRef.current.dispose();
          } catch {
            // ignore
          }
          apiRef.current = null;
        }
      };
    }

    setIframeSrc(null);
    setIsIframeFallback(false);

    const domainForApi =
      parsedServerUrl.protocol === "http:" && parsedServerUrl.host === normalizedDomain
        ? `${parsedServerUrl.protocol}//${parsedServerUrl.host}`
        : normalizedDomain;

    const scriptSrc = `/api/meetings/external-api?serverUrl=${encodeURIComponent(normalizedServerUrl)}`;

    function initJitsi() {
      if (!containerRef.current || !window.JitsiMeetExternalAPI) return;

      apiRef.current = new window.JitsiMeetExternalAPI(domainForApi, {
        roomName,
        ...(token ? { jwt: token } : {}),
        parentNode: containerRef.current,
        width: "100%",
        height: "100%",
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableDeepLinking: true,
          enableWelcomePage: false,
          prejoinPageEnabled: false,
          disableInviteFunctions: true,
          disableJoinLeaveNotifications: true,
          autoKnockLobby: true,
          enableLobby: true,
          lobby: {
            autoKnock: true,
            enabled: true,
          },
          ...(canInviteUsers
            ? {
                customToolbarButtons,
                buttonsWithNotifyClick: notifyToolbarButtons,
              }
            : {}),
          defaultLocalDisplayName: participantDisplayName,
          defaultRemoteDisplayName: participantDisplayName,
          bosh: signaling.bosh,
          ...(parsedServerUrl.protocol === "https:" ? { websocket: signaling.websocket } : {}),
          toolbarButtons,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_ALWAYS_VISIBLE: false,
        },
        userInfo: {
          displayName: participantDisplayName,
        },
      });

      apiRef.current.addListener("videoConferenceJoined", () => {
        handleConferenceJoined();

        if (isModerator && apiRef.current) {
          try {
            apiRef.current.executeCommand("toggleLobby", true);
          } catch {
            // Some Jitsi builds do not expose lobby toggle command.
          }
        }
      });

      apiRef.current.addListener("toolbarButtonClicked", (eventPayload) => {
        handleToolbarPayload(eventPayload);
      });

      apiRef.current.addListener("customToolbarButtonClicked", (eventPayload) => {
        handleToolbarPayload(eventPayload);
      });

      apiRef.current.addListener("readyToClose", () => {
        handleConferenceLeft();
        onClose();
      });

      apiRef.current.addListener("videoConferenceLeft", () => {
        handleConferenceLeft();
        onClose();
      });
    }

    // Load script if not already present
    if (window.JitsiMeetExternalAPI) {
      initJitsi();
    } else {
      const existing = document.querySelector(`script[src="${scriptSrc}"]`);
      if (existing) {
        existing.addEventListener("load", initJitsi);
      } else {
        const script = document.createElement("script");
        script.src = scriptSrc;
        script.async = true;
        script.onload = initJitsi;
        document.body.appendChild(script);
      }
    }

    return () => {
      handleConferenceLeft();
      if (apiRef.current) {
        try {
          apiRef.current.dispose();
        } catch {
          // ignore
        }
        apiRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleToolbarPayload]);

  function handleLeave() {
    if (apiRef.current) {
      try {
        apiRef.current.executeCommand("hangup");
      } catch {
        // ignore
      }
    }
    handleConferenceLeft();
    onClose();
  }

  function handleStartRecording() {
    if (!apiRef.current || !isModerator) return;
    try {
      apiRef.current.executeCommand("startRecording", { mode: "file" });
    } catch {
      // ignore
    }
  }

  async function handleCopyMeetingLink() {
    if (!meetingShareUrl) {
      toast.error("Meeting link is not ready yet");
      return;
    }

    try {
      await navigator.clipboard.writeText(meetingShareUrl);
      toast.success("Meeting link copied");
    } catch {
      toast.error("Could not copy meeting link");
    }
  }

  async function handleShareMeetingLink() {
    if (!meetingShareUrl) {
      toast.error("Meeting link is not ready yet");
      return;
    }

    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Join meeting",
          text: "Use this link to join the meeting",
          url: meetingShareUrl,
        });
        return;
      } catch {
        // Fall back to clipboard for cancelled/unsupported share flows.
      }
    }

    await handleCopyMeetingLink();
  }

  async function handleInviteParticipant(targetUserId: string, targetUserName: string) {
    if (!meetingId || invitingUserId) return;
    if (!canInviteUsers) {
      toast.error("Client users cannot invite participants");
      return;
    }
    if (!canInviteClients) {
      const selected = inviteResults.find((candidate) => candidate.id === targetUserId);
      if (selected?.role === "CLIENT") {
        toast.error("Only Admin and Project Manager can invite client users");
        return;
      }
    }
    if (!hasJoinedConference) {
      toast.error("Join the meeting first to invite participants");
      return;
    }

    setInvitingUserId(targetUserId);
    try {
      await syncMeetingPresence("POST");

      const res = await fetch(`/api/meetings/${meetingId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to invite participant");

      toast.success(`${targetUserName} invited to the meeting`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to invite participant");
    } finally {
      setInvitingUserId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-base-200 border-b border-base-300 flex-shrink-0">
        <span className="text-sm font-semibold text-base-content truncate">Meeting</span>
        <div className="flex items-center gap-2">
          {isModerator && !isIframeFallback && (
            <button
              className="btn btn-sm btn-outline btn-error gap-2"
              onClick={handleStartRecording}
              title="Start recording"
            >
              <Radio className="w-4 h-4" />
              Record
            </button>
          )}
          <button
            className="btn btn-sm btn-error gap-2"
            onClick={handleLeave}
          >
            <PhoneOff className="w-4 h-4" />
            {isModerator ? "End" : "Leave"}
          </button>
        </div>
      </div>

      {inviteModalOpen && (
        <div
          className="absolute inset-0 z-[60] flex items-start justify-end bg-black/40 p-4"
          onClick={() => setInviteModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-base-300 bg-base-100 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-base-content">Invite participant</h2>
              <button
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => setInviteModalOpen(false)}
                aria-label="Close invite dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="input input-bordered input-sm flex items-center gap-2 mt-3">
              <Search className="w-4 h-4 text-base-content/50" />
              <input
                type="text"
                className="grow"
                placeholder={canInviteClients ? "Search user by name" : "Search non-client user by name"}
                value={inviteQuery}
                onChange={(e) => setInviteQuery(e.target.value)}
              />
            </label>

            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {inviteLoading ? (
                <div className="flex justify-center py-6">
                  <span className="loading loading-spinner loading-md text-primary" />
                </div>
              ) : inviteResults.length === 0 ? (
                <p className="py-4 text-center text-xs text-base-content/50">
                  {canInviteClients ? "No users found" : "No non-client users found"}
                </p>
              ) : (
                inviteResults.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between rounded-lg border border-base-300 bg-base-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-base-content">{candidate.name}</p>
                      <p className="truncate text-xs text-base-content/60">{candidate.role}</p>
                    </div>
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() => void handleInviteParticipant(candidate.id, candidate.name)}
                      disabled={invitingUserId !== null}
                    >
                      {invitingUserId === candidate.id ? "Inviting..." : "Invite"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isMounted && meetingId && canInviteUsers && hasJoinedConference
        ? createPortal(
            <div className="toolbox-content crm-toolbox-content fixed left-4 top-20 z-[2147483000] sm:left-6 sm:top-24">
              <div className="pointer-events-auto flex w-44 max-w-[calc(100vw-2rem)] flex-col items-stretch gap-2 rounded-xl border border-white/15 bg-black/85 p-2 shadow-2xl backdrop-blur">
                <button
                  className="toolbox-button crm-toolbox-button inline-flex w-full items-center justify-start gap-1 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/20"
                  onClick={() => {
                    handleToolbarPayload({
                      key: INVITE_TOOLBAR_BUTTON_ID,
                      source: "toolbox-content",
                    });
                  }}
                  title="Invite existing member"
                  data-toolbox-key={INVITE_TOOLBAR_BUTTON_ID}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite
                </button>
                <button
                  className="toolbox-button crm-toolbox-button inline-flex w-full items-center justify-start gap-1 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/20"
                  onClick={() => {
                    handleToolbarPayload({
                      key: ADD_PARTICIPANT_TOOLBAR_BUTTON_ID,
                      source: "toolbox-content",
                    });
                  }}
                  title="Add participant by link"
                  data-toolbox-key={ADD_PARTICIPANT_TOOLBAR_BUTTON_ID}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Add participant
                </button>
              </div>
            </div>,
            document.body
          )
        : null}

      {linkModalOpen && (
        <div
          className="absolute inset-0 z-[60] flex items-start justify-end bg-black/40 p-4"
          onClick={() => setLinkModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-base-300 bg-base-100 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-base-content">Add participant by link</h2>
              <button
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => setLinkModalOpen(false)}
                aria-label="Close link dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-base-content/70">
              Share this meeting link with a participant. They can join directly from it.
            </p>

            <input
              type="text"
              readOnly
              value={meetingShareUrl}
              className="input input-bordered input-sm mt-3 w-full"
            />

            <div className="mt-3 flex items-center gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => void handleCopyMeetingLink()}>
                Copy link
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => void handleShareMeetingLink()}>
                Share link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jitsi iframe container */}
      {iframeSrc ? (
        <iframe
          src={iframeSrc}
          title="Jitsi meeting"
          className="flex-1 w-full border-0"
          allow="autoplay; camera; microphone; display-capture; fullscreen"
        />
      ) : (
        <div ref={containerRef} className="flex-1 w-full" />
      )}
    </div>
  );
}

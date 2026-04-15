"use client";

import { useEffect, useRef } from "react";
import { PhoneOff, Radio } from "lucide-react";

interface JitsiMeetingProps {
  domain: string;
  roomName: string;
  token?: string | null;
  displayName: string;
  isModerator: boolean;
  onClose: () => void;
}

interface JitsiAPI {
  addListener: (event: string, handler: () => void) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  dispose: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (domain: string, options: Record<string, unknown>) => JitsiAPI;
  }
}

export default function JitsiMeeting({
  domain,
  roomName,
  token,
  displayName,
  isModerator,
  onClose,
}: JitsiMeetingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiAPI | null>(null);

  useEffect(() => {
    const normalizedDomain = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const scriptSrc = `https://${normalizedDomain}/external_api.js`;

    function initJitsi() {
      if (!containerRef.current || !window.JitsiMeetExternalAPI) return;

      apiRef.current = new window.JitsiMeetExternalAPI(normalizedDomain, {
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
          toolbarButtons: [
            "microphone",
            "camera",
            "desktop",
            "chat",
            "participants-pane",
            "fullscreen",
            "settings",
            ...(isModerator ? ["recording", "mute-everyone"] : []),
          ],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_ALWAYS_VISIBLE: false,
        },
        userInfo: {
          displayName,
        },
      });

      apiRef.current.addListener("readyToClose", () => {
        onClose();
      });

      apiRef.current.addListener("videoConferenceLeft", () => {
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
  }, []);

  function handleLeave() {
    if (apiRef.current) {
      try {
        apiRef.current.executeCommand("hangup");
      } catch {
        // ignore
      }
    }
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-base-200 border-b border-base-300 flex-shrink-0">
        <span className="text-sm font-semibold text-base-content truncate">Meeting</span>
        <div className="flex items-center gap-2">
          {isModerator && (
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

      {/* Jitsi iframe container */}
      <div ref={containerRef} className="flex-1 w-full" />
    </div>
  );
}

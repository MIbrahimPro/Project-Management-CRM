"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const LiveKitMeeting = dynamic(() => import("@/components/meetings/LiveKitMeeting"), { ssr: false });

type JoinData = {
  meetingId: string;
  liveKitRoomId: string;
  title: string;
  url: string;
  token: string | null;
  isModerator: boolean;
  canInviteUsers: boolean;
  canInviteClients: boolean;
  displayName?: string | null;
  email?: string | null;
};

type UserMe = { name: string; role: string; profilePicUrl?: string | null };

export default function MeetingJoinPage() {
  const params = useParams<{ id: string; meetingId: string }>();
  const router = useRouter();
  const projectId = params?.id ?? "";
  const meetingId = params?.meetingId ?? "";

  const [joinData, setJoinData] = useState<JoinData | null>(null);
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [prejoinAv, setPrejoinAv] = useState<{ audio: boolean; video: boolean } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/meetings/${meetingId}/join-token`).then((r) => r.json()),
      fetch("/api/users/me").then((r) => r.json()),
    ])
      .then(
        ([joinRes, userRes]: [
          { data?: JoinData & { title?: string }; error?: string; code?: string },
          { data?: UserMe },
        ]) => {
          if (joinRes.code === "GONE") {
            setError("This meeting has already ended.");
            return;
          }
          if (joinRes.code === "FORBIDDEN") {
            setError("You are not invited to this meeting.");
            return;
          }
          if (!joinRes.data) {
            setError(joinRes.error ?? "Meeting not found.");
            return;
          }
          setJoinData({ ...joinRes.data, title: joinRes.data.title ?? "Meeting" });
          setUser(userRes.data ?? null);
        },
      )
      .catch(() => setError("Failed to load meeting details."))
      .finally(() => setLoading(false));
  }, [meetingId]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 text-base-content/20">🎥</div>
        <p className="text-base-content/60 text-lg">{error}</p>
        <button
          className="btn btn-ghost gap-2"
          onClick={() => router.push(`/projects/${projectId}/meetings`)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Meetings
        </button>
      </div>
    );
  }

  if (!joinData || !user) return null;

  if (joined && prejoinAv) {
    return (
      <LiveKitMeeting
        meetingId={joinData.meetingId}
        projectId={projectId}
        url={joinData.url}
        roomName={joinData.liveKitRoomId}
        title={joinData.title}
        token={joinData.token}
        displayName={user.name}
        email={joinData.email}
        isModerator={joinData.isModerator}
        canInviteUsers={joinData.canInviteUsers}
        canInviteClients={joinData.canInviteClients}
        initialMicOn={prejoinAv.audio}
        initialVideoOn={prejoinAv.video}
        skipPrejoin
        onClose={() => router.push(`/projects/${projectId}/meetings`)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-black/70 backdrop-blur-[2px]">
      {/* Minimal popup: bottom sheet on small screens, floating card on md+ */}
      <div
        className="
          w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl
          bg-base-100 border border-base-content/10 shadow-2xl
          overflow-hidden
        "
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-content/5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-base-content/50 uppercase tracking-wide">Join</p>
            <p className="text-sm font-semibold text-base-content truncate">{joinData.title}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Close"
            onClick={() => router.push(`/projects/${projectId}/meetings`)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="aspect-video bg-base-200 rounded-xl flex items-center justify-center relative overflow-hidden border border-base-content/5 max-h-[40vh] sm:max-h-none">
            <div className="text-center space-y-1">
              <div className="w-10 h-10 text-base-content/15 mx-auto">📷</div>
              <p className="text-[11px] text-base-content/40">Video enabled by default</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-base-content/60">Audio</p>
            <div
              className={`cursor-pointer p-3 rounded-lg border flex items-center justify-between ${
                prejoinAv?.audio !== false ? "border-primary bg-primary/10" : "border-error bg-error/10"
              }`}
              onClick={() => setPrejoinAv((prev) => ({ ...prev!, audio: prev?.audio !== false ? false : true }))}
            >
              <div className="flex items-center gap-2">
                {prejoinAv?.audio !== false ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.669 12 4.116 12 5v14c0 .884-1.077 1.331-1.707.707L5.586 15z" />
                  </svg>
                )}
                <span className="text-sm font-medium">Microphone</span>
              </div>
              <div className="flex items-center gap-2">
                {prejoinAv?.audio !== false && (
                  <div className="flex gap-0.5 h-3 items-center">
                    <span className="w-0.5 h-1 bg-primary rounded-full animate-pulse" />
                    <span className="w-0.5 h-2 bg-primary rounded-full animate-pulse delay-75" />
                    <span className="w-0.5 h-1 bg-primary rounded-full animate-pulse delay-150" />
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-base-content/60">Video</p>
            <div
              className={`cursor-pointer p-3 rounded-lg border flex items-center justify-between ${
                prejoinAv?.video !== false ? "border-primary bg-primary/10" : "border-error bg-error/10"
              }`}
              onClick={() => setPrejoinAv((prev) => ({ ...prev!, video: prev?.video !== false ? false : true }))}
            >
              <div className="flex items-center gap-2">
                {prejoinAv?.video !== false ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M7 17h10l2-3-2-3H7l2 3-2 3z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664l-3.197-2.132A1 1 0 0010 11.168v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664l-3.197-2.132A1 1 0 0010 11.168v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664l-3.197-2.132A1 1 0 0010 11.168v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664l-3.197-2.132A1 1 0 0010 11.168v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664l-3.197-2.132A1 1 0 0010 11.168v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664l-3.197-2.132A1 1 0 0010 11.168v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664l-3.197-2.132" />
                  </svg>
                )}
                <span className="text-sm font-medium">Camera</span>
              </div>
              <div className="flex items-center gap-2">
                {prejoinAv?.video !== false && (
                  <div className="flex gap-0.5 h-3 items-center">
                    <span className="w-0.5 h-1 bg-primary rounded-full animate-pulse" />
                    <span className="w-0.5 h-2 bg-primary rounded-full animate-pulse delay-75" />
                    <span className="w-0.5 h-1 bg-primary rounded-full animate-pulse delay-150" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <button type="button" className="btn btn-primary btn-sm w-full" onClick={() => setJoined(true)}>
            Join now
          </button>
        </div>
      </div>
    </div>
  );
}

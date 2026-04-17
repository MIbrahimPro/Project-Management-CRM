"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";

const JitsiMeeting = dynamic(() => import("@/components/meetings/JitsiMeeting"), { ssr: false });

type MeetingJoinData = {
  meetingId: string;
  title: string;
  jitsiRoomId: string;
  domain: string;
  serverUrl?: string;
  token: string | null;
  displayName?: string | null;
  email?: string | null;
  isGuest?: boolean;
  isModerator: boolean;
  canInviteUsers: boolean;
  canInviteClients: boolean;
};

export default function MeetingJoinPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const meetingId = params?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meeting, setMeeting] = useState<MeetingJoinData | null>(null);

  useEffect(() => {
    if (!meetingId) {
      setError("Meeting not found");
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetch(`/api/meetings/${meetingId}/join-token`, { cache: "no-store" })
      .then(async (meetingRes) => {
        const meetingPayload = (await meetingRes.json()) as {
          data?: MeetingJoinData;
          error?: string;
        };

        if (!meetingRes.ok || !meetingPayload.data) {
          throw new Error(meetingPayload.error ?? "Unable to join meeting");
        }

        if (cancelled) return;

        setMeeting(meetingPayload.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to join meeting");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  function handleClose() {
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    router.push("/chat");
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center bg-base-100 px-4">
        <div className="w-full max-w-md rounded-xl border border-base-300 bg-base-200 p-5 text-center">
          <h1 className="text-lg font-semibold text-base-content">Could not join meeting</h1>
          <p className="mt-2 text-sm text-base-content/70">{error ?? "Meeting not available"}</p>
          <button className="btn btn-primary btn-sm mt-4" onClick={() => router.push("/chat")}>
            Go to chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <JitsiMeeting
      meetingId={meeting.meetingId}
      domain={meeting.domain}
      serverUrl={meeting.serverUrl}
      roomName={meeting.jitsiRoomId}
      title={meeting.title}
      token={meeting.token}
      displayName={meeting.displayName}
      email={meeting.email}
      isGuest={meeting.isGuest}
      isModerator={meeting.isModerator}
      canInviteUsers={meeting.canInviteUsers}
      canInviteClients={meeting.canInviteClients}
      onClose={handleClose}
    />
  );
}

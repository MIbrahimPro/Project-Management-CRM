"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const JitsiMeeting = dynamic(() => import("@/components/meetings/JitsiMeeting"), { ssr: false });

type MeetingJoinData = {
  meetingId: string;
  title: string;
  jitsiRoomId: string;
  domain: string;
  serverUrl?: string;
  token: string | null;
  isModerator: boolean;
  canInviteUsers: boolean;
  canInviteClients: boolean;
  displayName?: string | null;
  email?: string | null;
  isGuest?: boolean;
};

export default function GuestMeetingJoinPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetingId = params?.id ?? "";
  const requestedName = (searchParams.get("name") ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meeting, setMeeting] = useState<MeetingJoinData | null>(null);

  const guestJoinUrl = useMemo(() => {
    if (!meetingId) return "";
    const query = new URLSearchParams({ guest: "1" });
    if (requestedName) query.set("name", requestedName);
    return `/api/meetings/${meetingId}/join-token?${query.toString()}`;
  }, [meetingId, requestedName]);

  useEffect(() => {
    if (!meetingId || !guestJoinUrl) {
      setError("Meeting not found");
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetch(guestJoinUrl, { cache: "no-store" })
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
  }, [guestJoinUrl, meetingId]);

  function handleClose() {
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex h-screen items-center justify-center bg-base-100 px-4">
        <div className="w-full max-w-md rounded-xl border border-base-300 bg-base-200 p-5 text-center">
          <h1 className="text-lg font-semibold text-base-content">Could not join meeting</h1>
          <p className="mt-2 text-sm text-base-content/70">{error ?? "Meeting not available"}</p>
          <button className="btn btn-primary btn-sm mt-4" onClick={() => router.push("/login")}>Go to login</button>
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
      displayName={meeting.displayName ?? (requestedName || "Guest")}
      email={meeting.email}
      isGuest
      isModerator={meeting.isModerator}
      canInviteUsers={meeting.canInviteUsers}
      canInviteClients={meeting.canInviteClients}
      onClose={handleClose}
    />
  );
}

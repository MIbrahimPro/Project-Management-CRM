"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";

const JitsiMeeting = dynamic(() => import("@/components/meetings/JitsiMeeting"), { ssr: false });

export default function PublicInterviewMeetingPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params?.roomId ?? "";
  const searchParams = useSearchParams();
  const requestedName = (searchParams.get("name") ?? "").trim();
  const domain = process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.jit.si";

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Just a small timeout to let everything mount, no server token needed for public meet.jit.si
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <JitsiMeeting
      meetingId={roomId}
      domain={domain}
      roomName={roomId}
      title="Interview"
      token={null} // Public room for interview
      displayName={requestedName || "Interview Guest"}
      isGuest={true}
      isModerator={false}
      canInviteUsers={false}
      canInviteClients={false}
      onClose={() => {
        window.close();
      }}
    />
  );
}

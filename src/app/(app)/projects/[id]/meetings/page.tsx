"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Video, Calendar, Clock, Plus, Users, X, CheckCircle2, PlayCircle, Copy, Pencil, Trash2, Check, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(duration);
dayjs.extend(relativeTime);

const LiveKitMeeting = dynamic(() => import("@/components/meetings/LiveKitMeeting"), { ssr: false });

const TOAST_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--bc))" };
const TOAST_ERROR_STYLE = { background: "hsl(var(--b2))", color: "hsl(var(--er))" };

type MeetingParticipant = {
  userId: string;
  user: { id: string; name: string };
  joinedAt: string;
  leftAt: string | null;
};

type MeetingRecording = {
  id: string;
  title: string | null;
  storagePath: string;
  durationSec: number | null;
  createdAt: string;
  uploadedBy: { name: string };
};

type Meeting = {
  id: string;
  title: string;
  liveKitRoomId: string;
  scheduledAt: string | null;
  startedAt: string;
  endedAt: string | null;
  isClientMeeting?: boolean;
  createdById: string;
  participants: MeetingParticipant[];
  recordings: MeetingRecording[];
  invitees?: { userId: string }[];
};

type ProjectMember = {
  id: string;
  user: { id: string; name: string; role: string; profilePicUrl: string | null };
};

type CurrentUser = {
  id: string;
  name: string;
  role: string;
  profilePicUrl?: string | null;
};

type LiveKitSession = {
  meetingId: string;
  liveKitRoomId: string;
  url: string;
  token: string | null;
  isModerator: boolean;
  title: string;
};

const MANAGER_ROLES = ["ADMIN", "PROJECT_MANAGER"];

function formatDuration(sec: number): string {
  const d = dayjs.duration(sec, "seconds");
  const h = Math.floor(d.asHours());
  const m = d.minutes();
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function ProjectMeetingsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMeeting, setActiveMeeting] = useState<LiveKitSession | null>(null);

  // Schedule modal state
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedTitle, setSchedTitle] = useState("");
  const [schedDateTime, setSchedDateTime] = useState("");
  const [schedNow, setSchedNow] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // Client meeting modal state
  const [showClientMeeting, setShowClientMeeting] = useState(false);
  const [cmTitle, setCmTitle] = useState("");
  const [cmDateTime, setCmDateTime] = useState("");
  const [cmNow, setCmNow] = useState(false);
  const [cmInvitedIds, setCmInvitedIds] = useState<Set<string>>(new Set());
  const [cmStep, setCmStep] = useState<1 | 2>(1);
  const [cmSaving, setCmSaving] = useState(false);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  // Edit/delete state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDateTime, setEditDateTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`/api/meetings?projectId=${projectId}`).then((r) => r.json()),
      fetch("/api/users/me").then((r) => r.json()),
    ])
      .then(([meetingsRes, userRes]: [{ data: Meeting[] }, { data: CurrentUser }]) => {
        setMeetings(meetingsRes.data ?? []);
        setUser(userRes.data);
      })
      .catch(() => toast.error("Failed to load meetings", { style: TOAST_ERROR_STYLE }))
      .finally(() => setLoading(false));
  }, [projectId]);

  const isManager = user ? MANAGER_ROLES.includes(user.role) : false;

  // Upcoming: not ended, scheduled in future OR startedAt within last 2min (in progress)
  const upcoming = meetings.filter((m) => !m.endedAt).sort((a, b) => {
    const aTime = a.scheduledAt ?? a.startedAt;
    const bTime = b.scheduledAt ?? b.startedAt;
    return aTime < bTime ? -1 : 1;
  });

  const past = meetings.filter((m) => m.endedAt).sort((a, b) =>
    b.startedAt > a.startedAt ? 1 : -1
  );

  function getUpcomingStatus(m: Meeting): { label: string; badge: string; canJoin: boolean } {
    if (m.scheduledAt) {
      const diff = dayjs(m.scheduledAt).diff(now, "minute");
      if (diff > 0) {
        return {
          label: `Scheduled for ${dayjs(m.scheduledAt).format("MMM D, h:mm A")} (${dayjs(m.scheduledAt).fromNow()})`,
          badge: "badge-info",
          canJoin: false,
        };
      }
    }
    // Started or past scheduled time
    return { label: "In Progress — Join", badge: "badge-success", canJoin: true };
  }

  async function openClientMeetingModal() {
    setCmStep(1);
    setCmTitle("");
    setCmDateTime("");
    setCmNow(false);
    setCmInvitedIds(new Set());
    if (projectMembers.length === 0) {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        const data = (await res.json()) as { data?: { members?: ProjectMember[] } };
        const members = (data.data?.members ?? []).filter(
          (m) => m.user.role !== "CLIENT" && !MANAGER_ROLES.includes(m.user.role),
        );
        setProjectMembers(members);
      } catch {
        // ignore
      }
    }
    setShowClientMeeting(true);
  }

  async function handleStartClientMeeting() {
    if (!cmTitle.trim()) {
      toast.error("Meeting title is required", { style: TOAST_ERROR_STYLE });
      return;
    }
    setCmSaving(true);
    let win: Window | null = null;
    if (cmNow) {
      // Open a blank window synchronously to avoid popup blocking, we'll navigate it after creation
      try {
        win = window.open("about:blank", "_blank", "noopener");
      } catch {}
    }
    try {
      const body: Record<string, unknown> = {
        title: cmTitle,
        projectId,
        isClientMeeting: true,
        invitedMemberIds: Array.from(cmInvitedIds),
      };
      if (!cmNow && cmDateTime) body.scheduledAt = new Date(cmDateTime).toISOString();
      const res = await fetch("/api/meetings/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { data?: LiveKitSession & { meetingId: string }; error?: string };
      if (!res.ok || !data.data) throw new Error(data.error ?? "Failed");

      toast.success(cmNow ? "Client meeting started!" : "Client meeting scheduled!", { style: TOAST_STYLE });
      setShowClientMeeting(false);

      const updated = (await fetch(`/api/meetings?projectId=${projectId}`).then((r) => r.json())) as { data: Meeting[] };
      setMeetings(updated.data ?? []);

      if (cmNow && data.data?.meetingId) {
        const url = `${window.location.origin}/join/meeting/${data.data.meetingId}`;
        try {
          if (win) {
            win.location.href = url;
          } else {
            window.open(url, "_blank", "noopener");
          }
        } catch {
          try { win && win.close(); } catch {}
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setCmSaving(false);
    }
  }

  async function handleStartOrSchedule() {
    if (!schedTitle.trim()) {
      toast.error("Meeting title is required", { style: TOAST_ERROR_STYLE });
      return;
    }
    setScheduling(true);
    let win: Window | null = null;
    if (schedNow) {
      try { win = window.open("about:blank", "_blank", "noopener"); } catch {}
    }
    try {
      const body: Record<string, unknown> = { title: schedTitle, projectId };
      if (!schedNow && schedDateTime) body.scheduledAt = new Date(schedDateTime).toISOString();

      const res = await fetch("/api/meetings/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { data?: LiveKitSession & { meetingId: string }; error?: string };
      if (!res.ok || !data.data) throw new Error(data.error ?? "Failed");

      toast.success(schedNow ? "Meeting started!" : "Meeting scheduled!", { style: TOAST_STYLE });
      setShowSchedule(false);
      setSchedTitle("");
      setSchedDateTime("");
      setSchedNow(false);

      // Reload meetings
      const updated = await fetch(`/api/meetings?projectId=${projectId}`).then((r) => r.json()) as { data: Meeting[] };
      setMeetings(updated.data ?? []);

      if (schedNow && data.data?.meetingId) {
        const url = `${window.location.origin}/join/meeting/${data.data.meetingId}`;
        try {
          if (win) {
            win.location.href = url;
          } else {
            window.open(url, "_blank", "noopener");
          }
        } catch {
          try { win && win.close(); } catch {}
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setScheduling(false);
    }
  }

  async function handleSaveEdit(meetingId: string) {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { title: editTitle };
      if (editDateTime) body.scheduledAt = new Date(editDateTime).toISOString();
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update meeting");
      toast.success("Meeting updated", { style: TOAST_STYLE });
      setEditingId(null);
      const updated = await fetch(`/api/meetings?projectId=${projectId}`).then((r) => r.json()) as { data: Meeting[] };
      setMeetings(updated.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(meetingId: string, title: string) {
    if (!confirm(`Cancel "${title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Meeting cancelled", { style: TOAST_STYLE });
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { style: TOAST_ERROR_STYLE });
    }
  }

  function handleCopyLink(meetingId: string) {
    const url = `${window.location.origin}/join/meeting/${meetingId}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedId(meetingId);
      toast.success("Join link copied", { style: TOAST_STYLE });
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function handleJoin(meeting: Meeting) {
    try {
      const url = `${window.location.origin}/join/meeting/${meeting.id}`;
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error("Failed to open meeting", { style: TOAST_ERROR_STYLE });
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-base-content">Meetings</h1>
          <p className="text-sm text-base-content/50">Video calls and recordings for this project</p>
        </div>
        {isManager && (
          <div className="flex items-center gap-2">
            <button
              className="btn btn-outline btn-sm gap-2"
              onClick={() => void openClientMeetingModal()}
            >
              <UserPlus className="w-4 h-4" />
              Meeting with Client
            </button>
            <button
              className="btn btn-primary btn-sm gap-2"
              onClick={() => setShowSchedule(true)}
            >
              <Plus className="w-4 h-4" />
              Schedule Meeting
            </button>
          </div>
        )}
      </div>

      {/* Upcoming / In Progress */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">Upcoming & In Progress</h2>
        {upcoming.length === 0 ? (
          <div className="bg-base-200 rounded-xl p-8 text-center text-base-content/40">
            <Video className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No upcoming meetings</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((m) => {
              const status = getUpcomingStatus(m);
              const isEditing = editingId === m.id;
              return (
                <div key={m.id} className="bg-base-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                        <Video className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        {isEditing ? (
                          <input
                            className="input input-bordered input-sm w-full"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-base-content truncate">{m.title}</p>
                            {m.isClientMeeting && (
                              <span className="badge badge-warning badge-xs">Client</span>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-base-content/50 mt-0.5">{status.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`badge badge-sm ${status.badge}`}>
                        {status.canJoin ? "In Progress" : "Scheduled"}
                      </span>
                      {status.canJoin && (
                        <button
                          className="btn btn-primary btn-sm gap-1"
                          onClick={() => void handleJoin(m)}
                        >
                          <PlayCircle className="w-4 h-4" />
                          Join
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm btn-circle"
                        onClick={() => handleCopyLink(m.id)}
                        title="Copy join link"
                      >
                        {copiedId === m.id ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      </button>
                      {isManager && !m.endedAt && (
                        <>
                          {isEditing ? (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => void handleSaveEdit(m.id)}
                                disabled={saving}
                              >
                                {saving ? <span className="loading loading-spinner loading-xs" /> : "Save"}
                              </button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-ghost btn-sm btn-circle"
                                title="Edit meeting"
                                onClick={() => {
                                  setEditingId(m.id);
                                  setEditTitle(m.title);
                                  setEditDateTime(m.scheduledAt ? dayjs(m.scheduledAt).format("YYYY-MM-DDTHH:mm") : "");
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm btn-circle text-error"
                                title="Cancel meeting"
                                onClick={() => void handleDelete(m.id, m.title)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                      <div className="flex items-center gap-1 text-xs text-base-content/40">
                        <Users className="w-3.5 h-3.5" />
                        {m.participants.length}
                      </div>
                    </div>
                  </div>
                  {isEditing && (
                    <div className="pl-13 ml-13">
                      <label className="text-xs text-base-content/50 block mb-1">Reschedule to</label>
                      <input
                        type="datetime-local"
                        className="input input-bordered input-sm"
                        value={editDateTime}
                        onChange={(e) => setEditDateTime(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Recordings */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">Past Meetings & Recordings</h2>
        {past.length === 0 ? (
          <div className="bg-base-200 rounded-xl p-8 text-center text-base-content/40">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No past meetings yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {past.map((m) => (
              <div key={m.id} className="bg-base-200 rounded-xl overflow-hidden border border-base-300">
                {/* Thumbnail / placeholder */}
                <div className="bg-base-300 h-32 flex items-center justify-center">
                  {m.recordings.length > 0 ? (
                    <div className="flex flex-col items-center gap-1 text-primary">
                      <PlayCircle className="w-10 h-10" />
                      <span className="text-xs font-medium">{m.recordings.length} recording{m.recordings.length !== 1 ? "s" : ""}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-base-content/20">
                      <CheckCircle2 className="w-10 h-10" />
                      <span className="text-xs">No recording</span>
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-base-content truncate flex-1">{m.title}</p>
                    {m.isClientMeeting && (
                      <span className="badge badge-warning badge-xs flex-shrink-0">Client</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-base-content/50">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {dayjs(m.startedAt).format("MMM D, YYYY")}
                    </span>
                    {m.endedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(dayjs(m.endedAt).diff(dayjs(m.startedAt), "second"))}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {m.participants.length}
                    </span>
                  </div>
                  {m.recordings.length > 0 && (
                    <div className="pt-1 space-y-1">
                      {m.recordings.map((rec) => (
                        <a
                          key={rec.id}
                          href={`/api/storage/signed-url?path=${encodeURIComponent(rec.storagePath)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline"
                        >
                          <PlayCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{rec.title ?? "Recording"}</span>
                          {rec.durationSec && <span className="text-base-content/40 flex-shrink-0">{formatDuration(rec.durationSec)}</span>}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showSchedule && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-base-300 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Schedule Meeting</h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowSchedule(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="form-control">
                <label className="label text-xs font-semibold">Meeting Title</label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  placeholder="e.g. Sprint Review"
                  autoFocus
                />
              </div>

              <div className="form-control flex-row items-center justify-between p-3 border border-base-300 rounded-xl">
                <div>
                  <span className="label-text font-semibold block">Start Now</span>
                  <span className="text-xs text-base-content/50">Join immediately without scheduling</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={schedNow}
                  onChange={(e) => setSchedNow(e.target.checked)}
                />
              </div>

              {!schedNow && (
                <div className="form-control">
                  <label className="label text-xs font-semibold">Date & Time</label>
                  <input
                    type="datetime-local"
                    className="input input-bordered"
                    value={schedDateTime}
                    onChange={(e) => setSchedDateTime(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}
            </div>
            <div className="p-4 border-t border-base-300 bg-base-200/50 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setShowSchedule(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => void handleStartOrSchedule()}
                disabled={scheduling || !schedTitle.trim() || (!schedNow && !schedDateTime)}
              >
                {scheduling ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : schedNow ? (
                  "Start Now"
                ) : (
                  "Schedule"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Meeting Modal */}
      {showClientMeeting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-base-300 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Start Meeting with Client</h3>
                <p className="text-xs text-base-content/50 mt-0.5">
                  Step {cmStep} of 2 — {cmStep === 1 ? "Schedule" : "Select members"}
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => setShowClientMeeting(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cmStep === 1 ? (
              <>
                <div className="p-5 space-y-4">
                  <div className="form-control">
                    <label className="label text-xs font-semibold">Meeting Title</label>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={cmTitle}
                      onChange={(e) => setCmTitle(e.target.value)}
                      placeholder="e.g. Design Review with Client"
                      autoFocus
                    />
                  </div>

                  <div className="form-control flex-row items-center justify-between p-3 border border-base-300 rounded-xl">
                    <div>
                      <span className="label-text font-semibold block">Start Now</span>
                      <span className="text-xs text-base-content/50">Skip scheduling, start immediately</span>
                    </div>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={cmNow}
                      onChange={(e) => setCmNow(e.target.checked)}
                    />
                  </div>

                  {!cmNow && (
                    <div className="form-control">
                      <label className="label text-xs font-semibold">Date & Time</label>
                      <input
                        type="datetime-local"
                        className="input input-bordered"
                        value={cmDateTime}
                        onChange={(e) => setCmDateTime(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-base-300 bg-base-200/50 flex justify-end gap-2">
                  <button className="btn btn-ghost" onClick={() => setShowClientMeeting(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => setCmStep(2)}
                    disabled={!cmTitle.trim() || (!cmNow && !cmDateTime)}
                  >
                    Next: Select Members
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-5 space-y-3">
                  <p className="text-sm text-base-content/60">
                    Select team members to include. The client and all managers are auto-added.
                  </p>
                  {projectMembers.length === 0 ? (
                    <p className="text-center text-sm text-base-content/40 py-4">
                      No non-manager team members
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-1 border border-base-300 rounded-xl bg-base-200/30 p-2">
                      {projectMembers.map((m) => {
                        const checked = cmInvitedIds.has(m.user.id);
                        return (
                          <label
                            key={m.user.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm checkbox-primary"
                              checked={checked}
                              onChange={(e) => {
                                setCmInvitedIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(m.user.id);
                                  else next.delete(m.user.id);
                                  return next;
                                });
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-base-content truncate">{m.user.name}</p>
                              <p className="text-xs text-base-content/40">{m.user.role}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-base-300 bg-base-200/50 flex justify-between gap-2">
                  <button className="btn btn-ghost" onClick={() => setCmStep(1)}>
                    Back
                  </button>
                  <button
                    className="btn btn-primary gap-2"
                    onClick={() => void handleStartClientMeeting()}
                    disabled={cmSaving}
                  >
                    {cmSaving ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : cmNow ? (
                      "Start Now"
                    ) : (
                      "Schedule"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Active meeting overlay */}
      {activeMeeting && user && (
        <LiveKitMeeting
          meetingId={activeMeeting.meetingId}
          projectId={projectId}
          url={activeMeeting.url}
          roomName={activeMeeting.liveKitRoomId}
          title={activeMeeting.title}
          token={activeMeeting.token}
          displayName={user.name}
          isModerator={activeMeeting.isModerator}
          canInviteUsers
          canInviteClients={isManager}
          onClose={() => setActiveMeeting(null)}
        />
      )}
    </div>
  );
}

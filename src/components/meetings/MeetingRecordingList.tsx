"use client";

import { useEffect, useState } from "react";
import { Download, Play, Trash2, Video } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";

interface Recording {
  id: string;
  title: string | null;
  storagePath: string;
  sizeBytes: number | null;
  durationSec: number | null;
  createdAt: string;
  uploadedBy: { name: string };
}

interface MeetingRecordingListProps {
  meetingId?: string;
  projectId?: string;
  workspaceId?: string;
  taskId?: string;
}

export default function MeetingRecordingList({ 
  meetingId, 
  projectId, 
  workspaceId, 
  taskId 
}: MeetingRecordingListProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const query = new URLSearchParams();
    if (meetingId) query.set("meetingId", meetingId);
    if (projectId) query.set("projectId", projectId);
    if (workspaceId) query.set("workspaceId", workspaceId);
    if (taskId) query.set("taskId", taskId);

    fetch(`/api/meetings/recordings?${query.toString()}`)
      .then(r => r.json())
      .then(d => setRecordings(d.data || []))
      .catch(() => toast.error("Failed to load recordings"))
      .finally(() => setLoading(false));
  }, [meetingId, projectId, workspaceId, taskId]);

  const handlePlay = async (path: string) => {
    try {
      const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
      const { data } = await res.json();
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      toast.error("Failed to open recording");
    }
  };

  if (loading) return <div className="flex justify-center p-8"><span className="loading loading-spinner" /></div>;
  if (recordings.length === 0) return (
    <div className="flex flex-col items-center justify-center p-8 text-base-content/40 bg-base-200/50 rounded-xl border border-dashed border-base-300">
      <Video className="w-12 h-12 mb-2 opacity-20" />
      <p>No recordings found</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {recordings.map((rec) => (
        <div key={rec.id} className="card bg-base-200 shadow-sm border border-base-300">
          <div className="card-body p-4">
            <h3 className="font-bold truncate" title={rec.title || "Untitled Recording"}>
              {rec.title || "Untitled Recording"}
            </h3>
            <div className="flex flex-col text-xs text-base-content/60 gap-1 mt-1">
              <span>{format(new Date(rec.createdAt), "PPP p")}</span>
              <span>By {rec.uploadedBy.name}</span>
              {rec.durationSec && (
                <span>Duration: {Math.floor(rec.durationSec / 60)}m {rec.durationSec % 60}s</span>
              )}
            </div>
            <div className="card-actions justify-end mt-4">
              <button 
                className="btn btn-primary btn-sm gap-2"
                onClick={() => handlePlay(rec.storagePath)}
              >
                <Play className="w-4 h-4" />
                Play
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

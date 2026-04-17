"use client";

import { useState } from "react";
import { Camera, Mic, MicOff, Video, VideoOff } from "lucide-react";

interface MeetingPreJoinProps {
  roomName: string;
  onJoin: (settings: { audio: boolean; video: boolean }) => void;
  onCancel: () => void;
}

export default function MeetingPreJoin({ roomName, onJoin, onCancel }: MeetingPreJoinProps) {
  const [audio, setAudio] = useState(true);
  const [video, setVideo] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-base-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-base-content/10">
        <div className="p-6 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-base-content">Ready to join?</h2>
            <p className="text-sm text-base-content/50 mt-1">{roomName}</p>
          </div>

          {/* Camera Preview Placeholder */}
          <div className="aspect-video bg-base-300 rounded-xl flex items-center justify-center relative group overflow-hidden border border-base-content/5">
            {video ? (
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end p-4">
                <p className="text-white text-xs font-medium">Camera is ON</p>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <VideoOff className="w-12 h-12 text-base-content/20 mx-auto" />
                <p className="text-xs text-base-content/40">Camera is OFF</p>
              </div>
            )}
            
            {/* Controls overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <button
                onClick={() => setAudio(!audio)}
                className={`btn btn-circle btn-sm ${audio ? "btn-ghost bg-white/10 hover:bg-white/20 text-white" : "btn-error"}`}
              >
                {audio ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setVideo(!video)}
                className={`btn btn-circle btn-sm ${video ? "btn-ghost bg-white/10 hover:bg-white/20 text-white" : "btn-error"}`}
              >
                {video ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              className="btn btn-primary w-full shadow-lg shadow-primary/20"
              onClick={() => onJoin({ audio, video })}
            >
              Join Meeting
            </button>
            <button className="btn btn-ghost w-full btn-sm" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
        
        <div className="bg-base-300/50 p-4 border-t border-base-content/5">
          <p className="text-[10px] text-center text-base-content/40 uppercase tracking-widest font-bold">
            Secure Encryption Enabled
          </p>
        </div>
      </div>
    </div>
  );
}

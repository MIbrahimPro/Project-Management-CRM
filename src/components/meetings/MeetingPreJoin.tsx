"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, Settings, X } from "lucide-react";

interface MeetingPreJoinProps {
  roomName: string;
  onJoin: (settings: { audio: boolean; video: boolean }) => void;
  onCancel: () => void;
}

export default function MeetingPreJoin({ roomName, onJoin, onCancel }: MeetingPreJoinProps) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    async function startPreview() {
      if (videoEnabled) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          setVideoEnabled(false);
        }
      } else {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
    }

    startPreview();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [videoEnabled]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-base-100/80 backdrop-blur-sm p-4">
      <div className="bg-base-200 border border-base-content/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Preview Area */}
        <div className="flex-1 bg-black relative aspect-video md:aspect-auto flex items-center justify-center">
          {videoEnabled ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
            />
          ) : (
            <div className="text-white/40 flex flex-col items-center gap-2">
              <VideoOff className="w-12 h-12" />
              <p className="text-sm">Camera is off</p>
            </div>
          )}
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`btn btn-circle ${audioEnabled ? "btn-primary" : "btn-error"}`}
            >
              {audioEnabled ? <Mic /> : <MicOff />}
            </button>
            <button
              onClick={() => setVideoEnabled(!videoEnabled)}
              className={`btn btn-circle ${videoEnabled ? "btn-primary" : "btn-error"}`}
            >
              {videoEnabled ? <Video /> : <VideoOff />}
            </button>
          </div>
        </div>

        {/* Join Info Area */}
        <div className="p-8 flex flex-col justify-center gap-6 md:w-80 bg-base-200">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold mb-1">Ready to join?</h2>
            <p className="text-base-content/60 text-sm truncate">{roomName}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => onJoin({ audio: audioEnabled, video: videoEnabled })}
              className="btn btn-primary w-full shadow-lg"
            >
              Join Now
            </button>
            <button onClick={onCancel} className="btn btn-ghost w-full">
              Cancel
            </button>
          </div>

          <div className="text-[10px] text-center opacity-40 uppercase tracking-widest">
            Powered by LiveKit
          </div>
        </div>
      </div>
    </div>
  );
}

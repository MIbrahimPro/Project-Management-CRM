"use client";

import { useState } from "react";
import { Clock, LogOut, Zap, X } from "lucide-react";
import toast from "react-hot-toast";

interface AttendanceOvertimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkInId: string;
}

export function AttendanceOvertimeModal({ isOpen, onClose, checkInId }: AttendanceOvertimeModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "checkout" | "overtime") {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/overtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkInId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      
      toast.success(action === "checkout" ? "Checked out successfully" : "Overtime session started");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-200 max-w-sm border border-primary/20 shadow-2xl shadow-primary/10">
        <div className="flex items-center justify-between mb-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
            <Clock className="w-6 h-6" />
          </div>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-xl font-bold text-base-content">Shift Complete!</h3>
        <p className="text-sm text-base-content/60 mt-2">
          You have completed your 8-hour shift. Would you like to check out now or continue working for another hour?
        </p>

        <div className="grid grid-cols-1 gap-3 mt-8">
          <button 
            className="btn btn-primary gap-2 h-auto py-3"
            onClick={() => handleAction("overtime")}
            disabled={loading}
          >
            <Zap className="w-4 h-4" />
            <div className="text-left">
              <div className="font-bold">Work 1 more hour</div>
              <div className="text-[10px] font-normal opacity-70">Accumulate overtime pay</div>
            </div>
          </button>

          <button 
            className="btn btn-outline gap-2 h-auto py-3"
            onClick={() => handleAction("checkout")}
            disabled={loading}
          >
            <LogOut className="w-4 h-4" />
            <div className="text-left">
              <div className="font-bold">Check Out</div>
              <div className="text-[10px] font-normal opacity-70">Finish for the day</div>
            </div>
          </button>
        </div>

        <p className="text-[10px] text-center text-base-content/40 mt-4">
          If no action is taken, you will remain active but won't accumulate overtime until confirmed.
        </p>
      </div>
      <div className="modal-backdrop bg-black/40 backdrop-blur-sm" onClick={onClose} />
    </dialog>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Reply, Trash2, Smile, X, Pin, PinOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MessageContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCopy: () => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onDelete?: () => void;
  onPin?: () => void;
  isPinned?: boolean;
  canPin?: boolean;
  isOwn: boolean;
  content: string | null;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageContextMenu({
  x,
  y,
  onClose,
  onCopy,
  onReply,
  onReact,
  onDelete,
  onPin,
  isPinned,
  canPin,
  isOwn,
  content,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const padding = 16;
      let newX = x;
      let newY = y;

      if (x + menuRect.width > window.innerWidth - padding) {
        newX = window.innerWidth - menuRect.width - padding;
      }
      if (y + menuRect.height > window.innerHeight - padding) {
        newY = window.innerHeight - menuRect.height - padding;
      }

      setAdjustedPos({ x: newX, y: newY });
    }
  }, [x, y]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      className="fixed z-[110] w-56 bg-base-100 border border-base-300 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
    >
      {/* Quick Reactions */}
      <div className="flex items-center justify-between p-2 bg-base-200/50 border-b border-base-300">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onReact(emoji);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center hover:bg-base-300 rounded-lg transition-all hover:scale-125 text-lg"
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="p-1">
        {content && (
          <button
            onClick={() => {
              onCopy();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-base-200 rounded-xl transition-colors"
          >
            <Copy className="w-4 h-4 text-base-content/60" />
            <span>Copy Text</span>
          </button>
        )}
        <button
          onClick={() => {
            onReply();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-base-200 rounded-xl transition-colors"
        >
          <Reply className="w-4 h-4 text-base-content/60" />
          <span>Reply</span>
        </button>
        
        {canPin && onPin && (
          <button
            onClick={() => {
              onPin();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-base-200 rounded-xl transition-colors"
          >
            {isPinned ? (
              <>
                <PinOff className="w-4 h-4 text-base-content/60" />
                <span>Unpin Message</span>
              </>
            ) : (
              <>
                <Pin className="w-4 h-4 text-base-content/60" />
                <span>Pin Message</span>
              </>
            )}
          </button>
        )}
        
        {(isOwn || onDelete) && onDelete && (
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-error/10 text-error rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Message</span>
          </button>
        )}
      </div>

      <div className="p-1 border-t border-base-300">
        <button
          onClick={onClose}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-base-200 rounded-xl transition-colors text-base-content/40"
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </button>
      </div>
    </motion.div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ResizablePanelProps {
  children: React.ReactNode;
  /** Default width in pixels */
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** localStorage key for persisting width */
  storageKey: string;
  /** Which edge has the drag handle */
  handleSide?: "right" | "left";
  className?: string;
}

/**
 * A panel whose width can be adjusted by dragging its edge.
 * Persists the width to localStorage under `storageKey`.
 */
export function ResizablePanel({
  children,
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
  handleSide = "right",
  className = "",
}: ResizablePanelProps) {
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return defaultWidth;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const n = Number(saved);
      if (Number.isFinite(n) && n >= minWidth && n <= maxWidth) return n;
    }
    return defaultWidth;
  });

  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    localStorage.setItem(storageKey, String(width));
  }, [width, storageKey]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      function onMouseMove(ev: MouseEvent) {
        if (!dragging.current) return;
        const dx = ev.clientX - startX.current;
        const newW = handleSide === "right"
          ? startWidth.current + dx
          : startWidth.current - dx;
        setWidth(Math.min(maxWidth, Math.max(minWidth, newW)));
      }

      function onMouseUp() {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [width, minWidth, maxWidth, handleSide],
  );

  const handle = (
    <div
      onMouseDown={onMouseDown}
      className={`w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors flex-shrink-0 ${
        handleSide === "right" ? "order-last" : "order-first"
      }`}
    />
  );

  return (
    <div className={`flex flex-shrink-0 ${className}`} style={{ width }}>
      {handleSide === "left" && handle}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">{children}</div>
      {handleSide === "right" && handle}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { User, Moon } from "lucide-react";
import { useCachedAvatar } from "@/hooks/useCachedAvatar";

interface UserAvatarProps {
  /** Display name for initials fallback. */
  user: { name: string; profilePicUrl?: string | null; timezone?: string | null };
  size?: 24 | 28 | 32 | 48 | 64 | 96 | 128;
  showPresence?: boolean;
  isOnline?: boolean;
  /** Show moon icon when user is offline and it's night time in their timezone */
  showMoon?: boolean;
}

const FALLBACK_COLORS = [
  "bg-primary",
  "bg-secondary",
  "bg-accent",
  "bg-info",
  "bg-success",
  "bg-warning",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getFallbackColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

const TEXT_SIZE_MAP: Record<number, string> = {
  24: "text-xs",
  28: "text-xs",
  32: "text-sm",
  48: "text-lg",
  64: "text-xl",
  96: "text-3xl",
  128: "text-4xl",
};

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function isPrivateStoragePath(s: string): boolean {
  return (
    s.startsWith("profile-pics/") || 
    s.startsWith("chat-media/") ||
    s.startsWith("workspace-task-media/") ||
    s.startsWith("photos/")
  );
}

function extractPathFromSupabaseUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const marker = "/devrolin-files/";
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length)).split("?")[0];
  } catch {
    return null;
  }
}

// Extract storage path from various URL formats or return as-is if already a path
function getStoragePath(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already a private storage path
  if (isPrivateStoragePath(trimmed)) {
    return trimmed;
  }

  // Extract path from full Supabase URL
  const extracted = extractPathFromSupabaseUrl(trimmed);
  if (extracted) {
    return extracted;
  }

  // Not a recognized format
  return null;
}

/**
 * Resolves `profilePicUrl` for display with caching.
 */
export function UserAvatar({
  user,
  size = 32,
  showPresence = false,
  isOnline = false,
  showMoon = false,
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine the storage path for caching
  const raw = user.profilePicUrl?.trim() ?? "";
  const storagePath = getStoragePath(raw);

  // Use cached avatar hook for private storage paths
  const { url: cachedUrl } = useCachedAvatar(storagePath);

  // Determine final image source
  let resolvedSrc: string | null = null;
  if (storagePath && cachedUrl) {
    resolvedSrc = cachedUrl;
  } else if (isHttpUrl(raw) && !storagePath) {
    // Public HTTP URL, use directly
    resolvedSrc = raw;
  }

  const hasProfilePic = Boolean(resolvedSrc) && !imgError;
  const px = `${size}px`;
  const sizeStyle = { width: px, height: px, minWidth: px };
  const textSize = TEXT_SIZE_MAP[size] || "text-sm";
  const iconSize = Math.max(size / 2, 12);

  if (!mounted) {
    return (
      <div
        className="rounded-full bg-base-300 flex items-center justify-center"
        style={sizeStyle}
      >
        <User style={{ width: iconSize, height: iconSize }} className="text-base-content/50" />
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      {hasProfilePic ? (
        <img
          src={resolvedSrc!}
          alt={user.name}
          className="rounded-full object-cover"
          style={sizeStyle}
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className={`rounded-full ${getFallbackColor(user.name)} flex items-center justify-center`}
          style={sizeStyle}
        >
          <span className={`${textSize} text-white font-medium`}>
            {getInitials(user.name)}
          </span>
        </div>
      )}
      {/* Online = green bubble, Offline at night = moon icon */}
      {showPresence && isOnline && (
        <span className="absolute bottom-0 right-0 w-3 h-3 border-2 border-base-100 rounded-full bg-success" />
      )}
      {showMoon && !isOnline && (
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-base-200 rounded-full flex items-center justify-center border border-base-100">
          <Moon className="w-2.5 h-2.5 text-info" />
        </span>
      )}
    </div>
  );
}

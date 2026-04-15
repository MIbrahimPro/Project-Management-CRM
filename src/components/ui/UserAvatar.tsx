"use client";

import { useState, useEffect } from "react";
import { User } from "lucide-react";

interface UserAvatarProps {
  /** Display name for initials fallback. */
  user: { name: string; profilePicUrl?: string | null };
  size?: 24 | 28 | 32 | 48 | 64 | 96 | 128;
  showOnline?: boolean;
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
  return s.startsWith("profile-pics/");
}

/**
 * Resolves `profilePicUrl` for display: Supabase private paths (`profile-pics/...`)
 * become a short-lived signed URL via `/api/storage/signed-url`. Already-signed https
 * URLs are used as-is.
 */
export function UserAvatar({ user, size = 32, showOnline = false }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setImgError(false);
    const raw = user.profilePicUrl?.trim() ?? "";
    if (!raw) {
      setResolvedSrc(null);
      return;
    }
    if (isHttpUrl(raw)) {
      setResolvedSrc(raw);
      return;
    }
    if (isPrivateStoragePath(raw)) {
      let cancelled = false;
      setResolvedSrc(null);
      fetch(`/api/storage/signed-url?path=${encodeURIComponent(raw)}`, {
        credentials: "include",
      })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json() as Promise<{ url?: string }>;
        })
        .then((d) => {
          if (!cancelled && d.url) setResolvedSrc(d.url);
        })
        .catch(() => {
          if (!cancelled) setResolvedSrc(null);
        });
      return () => {
        cancelled = true;
      };
    }
    setResolvedSrc(null);
  }, [user.profilePicUrl]);

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
          src={resolvedSrc as string}
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
      {showOnline && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-base-100 rounded-full" />
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";

// Global cache for signed URLs: path -> { url, expiresAt }
const urlCache = new Map<string, { url: string; expiresAt: number }>();

// Pending requests to avoid duplicate fetches
const pendingRequests = new Map<string, Promise<string | null>>();

// Cache duration: 45 minutes (signed URLs typically valid for 1 hour)
const CACHE_DURATION_MS = 45 * 60 * 1000;

async function fetchSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;

  // Check cache first
  const cached = urlCache.get(path);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  // Check if there's already a pending request for this path
  if (pendingRequests.has(path)) {
    return pendingRequests.get(path)!;
  }

  // Create new request
  const request = fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`)
    .then(async (res) => {
      if (!res.ok) throw new Error("Failed to get signed URL");
      const data = await res.json();
      const url = data.url ?? null;

      if (url) {
        // Store in cache
        urlCache.set(path, {
          url,
          expiresAt: Date.now() + CACHE_DURATION_MS,
        });
      }

      return url;
    })
    .catch(() => null)
    .finally(() => {
      pendingRequests.delete(path);
    });

  pendingRequests.set(path, request);
  return request;
}

export function useCachedAvatar(profilePicUrl: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!profilePicUrl) {
      setUrl(null);
      return;
    }

    setIsLoading(true);
    try {
      const signedUrl = await fetchSignedUrl(profilePicUrl);
      setUrl(signedUrl);
    } finally {
      setIsLoading(false);
    }
  }, [profilePicUrl]);

  useEffect(() => {
    if (!profilePicUrl) {
      setUrl(null);
      return;
    }

    // Check cache immediately
    const cached = urlCache.get(profilePicUrl);
    if (cached && Date.now() < cached.expiresAt) {
      setUrl(cached.url);
      return;
    }

    // Fetch if not cached or expired
    setIsLoading(true);
    fetchSignedUrl(profilePicUrl).then((signedUrl) => {
      setUrl(signedUrl);
      setIsLoading(false);
    });
  }, [profilePicUrl]);

  return { url, isLoading, refresh };
}

// Preload multiple avatars at once (useful for lists)
export function preloadAvatars(paths: (string | null | undefined)[]) {
  const validPaths = paths.filter((p): p is string => Boolean(p));
  const uniquePaths = Array.from(new Set(validPaths));

  uniquePaths.forEach((path) => {
    const cached = urlCache.get(path);
    if (!cached || Date.now() >= cached.expiresAt) {
      void fetchSignedUrl(path);
    }
  });
}

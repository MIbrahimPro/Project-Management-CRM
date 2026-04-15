import { useEffect, useState } from "react";

/**
 * Fetches a short-lived signed URL for a private storage path (authenticated).
 */
export function useWorkspaceSignedUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { url?: string }) => {
        if (!cancelled) setUrl(d.url ?? null);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}

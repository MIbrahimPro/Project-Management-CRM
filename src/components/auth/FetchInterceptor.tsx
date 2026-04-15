"use client";

import { useEffect } from "react";

/**
 * Installs a global fetch interceptor that transparently refreshes expired
 * access tokens on 401 responses from same-origin /api/* calls, then retries
 * the original request. If refresh fails, redirects to /login.
 *
 * Mounted once in ClientLayout so every fetch() call in the authenticated
 * portion of the app benefits without any call-site changes.
 */
export function FetchInterceptor() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const originalFetch = window.fetch.bind(window);

    // Prevent double-install (fast refresh, etc.)
    if ((window.fetch as unknown as { __intercepted?: boolean }).__intercepted) return;

    let refreshPromise: Promise<boolean> | null = null;

    async function refreshOnce(): Promise<boolean> {
      if (!refreshPromise) {
        refreshPromise = originalFetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        })
          .then((res) => res.ok)
          .catch(() => false)
          .finally(() => {
            // Small delay before next attempt slot opens so we don't thunder
            setTimeout(() => {
              refreshPromise = null;
            }, 100);
          });
      }
      return refreshPromise;
    }

    function isInternalApiCall(input: RequestInfo | URL): boolean {
      try {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
        if (!url) return false;
        if (url.startsWith("/api/")) return true;
        const u = new URL(url, window.location.origin);
        return u.origin === window.location.origin && u.pathname.startsWith("/api/");
      } catch {
        return false;
      }
    }

    const interceptor: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);

      if (response.status !== 401) return response;
      if (!isInternalApiCall(input)) return response;

      // Don't try to refresh the refresh endpoint itself (avoid loops).
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/api/auth/refresh") || url.includes("/api/auth/login") || url.includes("/api/auth/logout")) {
        return response;
      }

      const refreshed = await refreshOnce();
      if (!refreshed) {
        // Refresh failed — redirect to login with the current path as returnTo.
        if (!window.location.pathname.startsWith("/login")) {
          const returnTo = window.location.pathname + window.location.search;
          window.location.href = `/login?redirect=${encodeURIComponent(returnTo)}`;
        }
        return response;
      }

      // Retry the original request once with the same input/init.
      return originalFetch(input, init);
    };

    (interceptor as unknown as { __intercepted?: boolean }).__intercepted = true;
    window.fetch = interceptor;

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}

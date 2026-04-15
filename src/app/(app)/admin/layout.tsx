"use client";

import { useEffect } from "react";
import { useSidebarOverride } from "@/components/layout/ClientLayout";
import { getAdminSidebarItems } from "@/config/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { setOverride } = useSidebarOverride();

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { data?: { role: string } }) => {
        if (cancelled) return;
        const role = d.data?.role ?? "";
        setOverride(getAdminSidebarItems(role));
      })
      .catch(() => {
        if (!cancelled) setOverride(getAdminSidebarItems(""));
      });
    return () => {
      cancelled = true;
      setOverride(null);
    };
  }, [setOverride]);

  return <>{children}</>;
}

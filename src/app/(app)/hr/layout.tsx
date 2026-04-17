"use client";

import { useEffect } from "react";
import { useSidebarOverride } from "@/components/layout/ClientLayout";
import { getHrSidebarItems } from "@/config/sidebar";

export default function HrLayout({ children }: { children: React.ReactNode }) {
  const { setOverride } = useSidebarOverride();

  useEffect(() => {
    setOverride(getHrSidebarItems());
    return () => setOverride(null);
  }, [setOverride]);

  return <>{children}</>;
}

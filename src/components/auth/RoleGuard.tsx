"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface RoleGuardProps {
  allowed: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function RoleGuard({ allowed, children, fallback, redirectTo }: RoleGuardProps) {
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { data?: { role: string } }) => {
        const userRole = d.data?.role ?? "";
        setRole(userRole);
        if (redirectTo && !allowed.includes(userRole)) {
          router.replace(redirectTo);
        }
      })
      .catch(() => {
        if (redirectTo) router.replace(redirectTo);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (role === null) return null;
  if (!allowed.includes(role)) return fallback ?? null;
  return <>{children}</>;
}

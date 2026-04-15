"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { CheckInWidget } from "@/components/attendance/CheckInWidget";

const ATTENDANCE_ROLES = new Set([
  "PROJECT_MANAGER",
  "DEVELOPER",
  "DESIGNER",
  "HR",
  "ACCOUNTANT",
  "SALES",
]);

interface DashboardClientStripProps {
  role: string;
}

/**
 * Interactive dashboard toolbar: check-in (when applicable) and notifications entry.
 */
export function DashboardClientStrip({ role }: DashboardClientStripProps) {
  const showCheckIn = ATTENDANCE_ROLES.has(role);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showCheckIn ? <CheckInWidget /> : null}
      <Link
        href="/notifications"
        className="btn btn-outline btn-sm gap-2 border-base-300 hover:border-primary"
      >
        <Bell className="w-4 h-4" />
        Notifications
      </Link>
    </div>
  );
}

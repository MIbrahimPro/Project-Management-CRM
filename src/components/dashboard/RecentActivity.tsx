import Link from "next/link";
import { Bell } from "lucide-react";
import type { Notification } from "@prisma/client";

interface RecentActivityProps {
  items: Notification[];
}

function formatRelativeTime(createdAt: Date): string {
  const now = new Date();
  const date = new Date(createdAt);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/**
 * Read-only notification list for the dashboard (week scoped from API).
 */
export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <div className="card bg-base-200 border border-base-300 shadow-sm h-full">
      <div className="card-body p-4 gap-3">
        <h2 className="card-title text-base text-base-content">Recent activity</h2>
        <ul className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
          {items.length === 0 ? (
            <li className="text-sm text-base-content/50">No updates this week.</li>
          ) : (
            items.map((n) => {
              const inner = (
                <div className="flex items-start gap-2 py-1">
                  <Bell className="w-4 h-4 text-base-content/50 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-base-content">{n.title}</p>
                    <p className="text-xs text-base-content/60 line-clamp-2">{n.body}</p>
                    <p className="text-xs text-base-content/40 mt-0.5">
                      {formatRelativeTime(n.createdAt)}
                    </p>
                  </div>
                </div>
              );

              return (
                <li key={n.id}>
                  {n.linkUrl ? (
                    <Link
                      href={n.linkUrl}
                      className="block rounded-lg hover:bg-base-300/50 transition-colors -mx-2 px-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-200"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="rounded-lg -mx-2 px-2">{inner}</div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

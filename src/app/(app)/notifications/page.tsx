"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { NOTIFICATION_COLORS, NOTIFICATION_ICONS } from "@/lib/notification-icons";
import { parseNotificationBody } from "@/lib/format-notification-body";
import type { NotificationType } from "@prisma/client";

export const dynamic = "force-dynamic";

dayjs.extend(relativeTime);

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Record<string, Notification[]>>({});
  const [unreadOnLoad, setUnreadOnLoad] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications?limit=100")
      .then((r) => r.json())
      .then((d: { data: { groups: Record<string, Notification[]> } }) => {
        const fetchedGroups = d.data.groups;
        setGroups(fetchedGroups);

        // Capture which were unread on arrival (for visual highlighting)
        const unreadIds = new Set<string>();
        for (const notifs of Object.values(fetchedGroups)) {
          for (const n of notifs) {
            if (!n.isRead) unreadIds.add(n.id);
          }
        }
        setUnreadOnLoad(unreadIds);
        setLoading(false);

        // Mark all as read after capturing unread state
        fetch("/api/notifications/mark-all-read", { method: "POST" }).catch(() => {});
      })
      .catch(() => setLoading(false));
  }, []);

  function markAllRead() {
    fetch("/api/notifications/mark-all-read", { method: "POST" }).catch(() => {});
    // Clear visual unread highlighting
    setUnreadOnLoad(new Set());
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const hasAny = Object.values(groups).some((g) => g.length > 0);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-base-content">Notifications</h1>
        {hasAny && (
          <button
            className="btn btn-ghost btn-sm text-base-content/60"
            onClick={markAllRead}
          >
            Mark all read
          </button>
        )}
      </div>

      {!hasAny && (
        <div className="text-center py-16 text-base-content/40">
          <div className="text-5xl mb-3">🔔</div>
          <p className="text-base">No notifications yet</p>
        </div>
      )}

      {Object.entries(groups).map(([dateLabel, notifs]) =>
        notifs.length === 0 ? null : (
          <div key={dateLabel}>
            {/* Date divider */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wide whitespace-nowrap">
                {dateLabel}
              </span>
              <div className="flex-1 h-px bg-base-300" />
            </div>

            <div className="space-y-1">
              {notifs.map((n) => {
                const Icon =
                  NOTIFICATION_ICONS[n.type] ?? NOTIFICATION_ICONS.GENERAL;
                const colorClass =
                  NOTIFICATION_COLORS[n.type] ?? NOTIFICATION_COLORS.GENERAL;
                const wasUnread = unreadOnLoad.has(n.id);

                return (
                  <div
                    key={n.id}
                    className={[
                      "flex items-start gap-3 p-3 rounded-lg transition-colors",
                      n.linkUrl ? "cursor-pointer" : "",
                      wasUnread
                        ? "bg-primary/5 border border-primary/20 hover:bg-primary/10"
                        : "hover:bg-base-200",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => n.linkUrl && router.push(n.linkUrl)}
                  >
                    {/* Icon */}
                    <div
                      className={`mt-0.5 p-2 rounded-lg bg-base-300 flex-shrink-0 ${colorClass}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${
                          wasUnread
                            ? "font-semibold text-base-content"
                            : "font-medium text-base-content/80"
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="text-sm text-base-content/60 mt-0.5 leading-relaxed">
                        {parseNotificationBody(n.body)}
                      </p>
                    </div>

                    {/* Relative time */}
                    <span className="text-xs text-base-content/40 flex-shrink-0 mt-0.5">
                      {dayjs(n.createdAt).fromNow()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}

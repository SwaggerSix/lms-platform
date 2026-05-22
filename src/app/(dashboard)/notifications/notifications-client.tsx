"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { cn } from "@/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { useNotificationStore } from "@/stores/notification-store";
import { useRealtimeSubscription } from "@/hooks/use-realtime";
import { RelativeTime } from "@/components/ui/relative-time";
import { RelativeTimeProvider } from "@/components/ui/relative-time-context";
import type { Notification as DbNotification } from "@/types/database";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  channel: string;
  created_at: string;
}


const TYPE_BADGES: Record<string, { label: string; cls: string }> = {
  reminder: { label: "Reminder", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  enrollment: { label: "Enrollment", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  completion: { label: "Completion", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  certification: { label: "Certification", cls: "bg-purple-50 text-purple-700 ring-purple-200" },
  announcement: { label: "Announcement", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  mention: { label: "Mention", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
};

export default function NotificationsClient({
  initialNotifications,
  userId,
}: {
  initialNotifications: NotificationRow[];
  userId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const {
    notifications: storeNotifications,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  // Seed the store with the server-rendered list on mount, then re-fetch to
  // pick up anything that arrived between SSR and hydration.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded) {
      useNotificationStore.setState((state) => ({
        ...state,
        notifications: initialNotifications as unknown as DbNotification[],
        unreadCount: initialNotifications.filter((n) => !n.is_read).length,
      }));
      setSeeded(true);
      fetchNotifications();
    }
  }, [seeded, initialNotifications, fetchNotifications]);

  // Real-time: prepend new notifications as they arrive.
  useRealtimeSubscription(supabase, {
    table: "notifications",
    event: "INSERT",
    filter: `user_id=eq.${userId}`,
    onData: (payload) => {
      const fresh = payload.new as unknown as DbNotification;
      if (fresh.channel !== "in_app") return;
      useNotificationStore.setState((state) => {
        if (state.notifications.some((n) => n.id === fresh.id)) return state;
        return {
          ...state,
          notifications: [fresh, ...state.notifications],
          unreadCount: state.unreadCount + (fresh.is_read ? 0 : 1),
        };
      });
    },
  });

  const notifications = storeNotifications.length > 0 ? storeNotifications : (initialNotifications as unknown as DbNotification[]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const filtered = useMemo(
    () => (filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications),
    [filter, notifications]
  );

  return (
    <RelativeTimeProvider>
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <Bell className="h-6 w-6 text-indigo-600" />
              Notifications
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                : "You're all caught up."}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          )}
        </div>

        <div className="mt-6 flex gap-2 border-b border-gray-200">
          {(["all", "unread"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                filter === key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {key === "all" ? "All" : "Unread"}
              <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                {key === "all" ? notifications.length : unreadCount}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">
                {filter === "unread" ? "No unread notifications." : "No notifications yet."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((notif) => {
                const badge = TYPE_BADGES[notif.type];
                const content = (
                  <div
                    className={cn(
                      "flex items-start gap-3 px-5 py-4 transition-colors hover:bg-gray-50",
                      !notif.is_read && "bg-indigo-50/30"
                    )}
                  >
                    <div className="mt-1 shrink-0">
                      {!notif.is_read ? (
                        <span className="block h-2 w-2 rounded-full bg-indigo-500" aria-label="Unread" />
                      ) : (
                        <span className="block h-2 w-2 rounded-full bg-transparent" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900">{notif.title}</p>
                        {badge && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                              badge.cls
                            )}
                          >
                            {badge.label}
                          </span>
                        )}
                      </div>
                      {notif.body && (
                        <p className="mt-0.5 text-sm text-gray-600 line-clamp-3">{notif.body}</p>
                      )}
                    </div>
                    <RelativeTime iso={notif.created_at} className="shrink-0 text-xs text-gray-500" />
                  </div>
                );

                if (notif.link) {
                  return (
                    <li key={notif.id}>
                      <Link
                        href={notif.link}
                        onClick={() => {
                          if (!notif.is_read) markAsRead(notif.id);
                        }}
                        className="block"
                      >
                        {content}
                      </Link>
                    </li>
                  );
                }
                return (
                  <li key={notif.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!notif.is_read) markAsRead(notif.id);
                      }}
                      className="block w-full text-left"
                    >
                      {content}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
    </RelativeTimeProvider>
  );
}

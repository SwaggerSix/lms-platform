"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/utils/cn";
import { useAuth } from "@/components/providers/auth-provider";
import { useNotificationStore } from "@/stores/notification-store";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification } from "@/types/database";

function formatWhen(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function NotificationRow({ notification }: { notification: Notification }) {
  const { markAsRead } = useNotificationStore();

  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{notification.title}</p>
        {notification.body && (
          <p className="mt-0.5 text-sm text-gray-500">{notification.body}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!notification.is_read && (
          <span className="h-2 w-2 rounded-full bg-primary-600" aria-label="Unread" />
        )}
        <span className="text-xs text-gray-500">{formatWhen(notification.created_at)}</span>
      </div>
    </div>
  );

  const rowClass = cn(
    "block border-b border-gray-100 px-4 py-3 transition-colors last:border-b-0",
    !notification.is_read && "bg-primary-50/50"
  );

  if (notification.link) {
    return (
      <Link
        href={notification.link}
        onClick={() => {
          if (!notification.is_read) markAsRead(notification.id);
        }}
        className={cn(rowClass, "hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50")}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={cn(rowClass, !notification.is_read && "cursor-pointer hover:bg-gray-50")}
      onClick={() => {
        if (!notification.is_read) markAsRead(notification.id);
      }}
    >
      {content}
    </div>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const { notifications, unreadCount, isLoading, fetchNotifications, markAllAsRead } =
    useNotificationStore();

  useEffect(() => {
    if (user?.id) fetchNotifications();
  }, [fetchNotifications, user?.id]);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`
              : "You're all caught up."}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => markAllAsRead()}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all read
          </Button>
        )}
      </div>

      {isLoading && notifications.length === 0 ? (
        <div className="space-y-3" aria-label="Loading notifications">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-10 w-10" aria-hidden="true" />}
          title="No notifications yet"
          description="Course updates, reminders, and announcements will show up here."
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white" role="list" aria-label="Notifications">
          {notifications.map((notification) => (
            <div role="listitem" key={notification.id}>
              <NotificationRow notification={notification} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { create } from "zustand";
import type { Notification } from "@/types/database";

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) {
        console.error("Failed to fetch notifications:", res.status);
        return;
      }
      const { notifications, unreadCount } = await res.json();
      set({ notifications: (notifications ?? []) as Notification[], unreadCount });
    } catch (err) {
      console.error("Unexpected error fetching notifications:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  markAsRead: async (notificationId) => {
    const { notifications } = get();
    const updated = notifications.map((n) =>
      n.id === notificationId ? { ...n, is_read: true } : n
    );
    const unreadCount = updated.filter((n) => !n.is_read).length;
    set({ notifications: updated, unreadCount });

    await fetch(`/api/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", notification_id: notificationId }),
    }).catch(() => {});
  },

  markAllAsRead: async () => {
    const { notifications } = get();
    const updated = notifications.map((n) => ({ ...n, is_read: true }));
    set({ notifications: updated, unreadCount: 0 });

    await fetch(`/api/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    }).catch(() => {});
  },
}));

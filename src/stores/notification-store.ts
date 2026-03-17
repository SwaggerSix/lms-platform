import { create } from "zustand";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Notification } from "@/types/database";

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: (supabase: SupabaseClient, userId: string) => Promise<void>;
  markAsRead: (supabase: SupabaseClient, notificationId: string) => Promise<void>;
  markAllAsRead: (supabase: SupabaseClient, userId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async (supabase, userId) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("channel", "in_app")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Failed to fetch notifications:", error.message);
        return;
      }

      const notifications = (data ?? []) as Notification[];
      const unreadCount = notifications.filter((n) => !n.is_read).length;
      set({ notifications, unreadCount });
    } catch (err) {
      console.error("Unexpected error fetching notifications:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  markAsRead: async (supabase, notificationId) => {
    const { notifications } = get();
    const updated = notifications.map((n) =>
      n.id === notificationId ? { ...n, is_read: true } : n
    );
    const unreadCount = updated.filter((n) => !n.is_read).length;
    set({ notifications: updated, unreadCount });

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
  },

  markAllAsRead: async (supabase, userId) => {
    const { notifications } = get();
    const updated = notifications.map((n) => ({ ...n, is_read: true }));
    set({ notifications: updated, unreadCount: 0 });

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
  },
}));

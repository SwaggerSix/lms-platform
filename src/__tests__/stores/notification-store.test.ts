import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNotificationStore } from "@/stores/notification-store";
import type { Notification } from "@/types/database";

const mockNotifications: Notification[] = [
  {
    id: "n1",
    user_id: "user-1",
    title: "Course completed",
    body: "You finished TypeScript 101",
    type: "completion",
    channel: "in_app",
    is_read: false,
    link: null,
    created_at: "2024-01-01",
  },
  {
    id: "n2",
    user_id: "user-1",
    title: "New assignment",
    body: "You have a new course assigned",
    type: "enrollment",
    channel: "in_app",
    is_read: true,
    link: null,
    created_at: "2024-01-02",
  },
];

beforeEach(() => {
  useNotificationStore.setState({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
  });
});

describe("useNotificationStore", () => {
  it("initializes with empty state", () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.unreadCount).toBe(0);
    expect(state.isLoading).toBe(false);
  });

  it("fetchNotifications loads and counts unread", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        notifications: mockNotifications,
        unreadCount: mockNotifications.filter((n) => !n.is_read).length,
      }),
    } as Response);

    await useNotificationStore.getState().fetchNotifications();

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(2);
    expect(state.unreadCount).toBe(1); // Only n1 is unread
    expect(state.isLoading).toBe(false);
  });

  it("markAsRead updates notification and count optimistically", async () => {
    // Set initial state
    useNotificationStore.setState({
      notifications: mockNotifications,
      unreadCount: 1,
    });

    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true } as Response);

    await useNotificationStore.getState().markAsRead("n1");

    const state = useNotificationStore.getState();
    expect(state.notifications.find((n) => n.id === "n1")?.is_read).toBe(true);
    expect(state.unreadCount).toBe(0);
  });

  it("markAllAsRead marks all as read", async () => {
    useNotificationStore.setState({
      notifications: mockNotifications,
      unreadCount: 1,
    });

    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true } as Response);

    await useNotificationStore.getState().markAllAsRead();

    const state = useNotificationStore.getState();
    expect(state.notifications.every((n) => n.is_read)).toBe(true);
    expect(state.unreadCount).toBe(0);
  });
});

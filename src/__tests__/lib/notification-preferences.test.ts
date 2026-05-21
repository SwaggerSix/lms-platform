import { describe, it, expect, vi } from "vitest";
import {
  fetchNotificationPrefs,
  userMaySend,
  type NotificationPrefs,
} from "@/lib/notifications/preferences";

describe("userMaySend", () => {
  it("returns true when prefs are undefined (default opt-in)", () => {
    expect(userMaySend(undefined, "recertification", "email")).toBe(true);
    expect(userMaySend(undefined, "recertification", "inApp")).toBe(true);
  });

  it("returns true when prefs object is empty", () => {
    expect(userMaySend({}, "recertification", "email")).toBe(true);
  });

  it("returns true when the category exists but the channel slot is undefined", () => {
    const prefs: NotificationPrefs = { recertification: { inApp: false } };
    expect(userMaySend(prefs, "recertification", "email")).toBe(true);
  });

  it("returns false when the channel is explicitly opted out", () => {
    expect(
      userMaySend({ recertification: { email: false } }, "recertification", "email")
    ).toBe(false);
    expect(
      userMaySend({ recertification: { inApp: false } }, "recertification", "inApp")
    ).toBe(false);
  });

  it("returns true when the channel is explicitly opted in", () => {
    expect(
      userMaySend({ recertification: { email: true } }, "recertification", "email")
    ).toBe(true);
  });

  it("does not leak opt-out from one category to another", () => {
    const prefs: NotificationPrefs = {
      enrollment: { email: false, inApp: false },
    };
    expect(userMaySend(prefs, "recertification", "email")).toBe(true);
    expect(userMaySend(prefs, "approvals", "inApp")).toBe(true);
  });

  it("handles all defined NotificationCategory values uniformly", () => {
    const cats = [
      "enrollment",
      "approvals",
      "due_dates",
      "recertification",
      "completions",
      "certificate",
      "discussions",
      "announcements",
      "digest",
    ] as const;
    for (const cat of cats) {
      expect(userMaySend(undefined, cat, "email")).toBe(true);
      expect(userMaySend({ [cat]: { email: false } }, cat, "email")).toBe(false);
    }
  });
});

describe("fetchNotificationPrefs", () => {
  function mockSupabase(rows: Array<{ id: string; preferences: Record<string, unknown> | null }>) {
    const inMock = vi.fn().mockResolvedValue({ data: rows, error: null });
    const selectMock = vi.fn().mockReturnValue({ in: inMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    return {
      client: { from: fromMock } as any,
      inMock,
      selectMock,
      fromMock,
    };
  }

  it("returns an empty map when given no user ids and does not query", async () => {
    const { client, fromMock } = mockSupabase([]);
    const result = await fetchNotificationPrefs(client, []);
    expect(result.size).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("queries the users table by id and unwraps preferences.notifications", async () => {
    const { client, fromMock, selectMock, inMock } = mockSupabase([
      {
        id: "u1",
        preferences: {
          notifications: {
            recertification: { email: false },
            completions: { inApp: false },
          },
        },
      },
      { id: "u2", preferences: { notifications: {} } },
      { id: "u3", preferences: null },
      { id: "u4", preferences: {} },
    ]);

    const result = await fetchNotificationPrefs(client, ["u1", "u2", "u3", "u4"]);

    expect(fromMock).toHaveBeenCalledWith("users");
    expect(selectMock).toHaveBeenCalledWith("id, preferences");
    expect(inMock).toHaveBeenCalledWith("id", ["u1", "u2", "u3", "u4"]);

    expect(result.get("u1")).toEqual({
      recertification: { email: false },
      completions: { inApp: false },
    });
    expect(result.get("u2")).toEqual({});
    expect(result.get("u3")).toEqual({});
    expect(result.get("u4")).toEqual({});
  });

  it("composes with userMaySend correctly across a batch", async () => {
    const { client } = mockSupabase([
      { id: "opt-out-email", preferences: { notifications: { recertification: { email: false } } } },
      { id: "opt-out-inapp", preferences: { notifications: { recertification: { inApp: false } } } },
      { id: "default", preferences: null },
    ]);
    const prefs = await fetchNotificationPrefs(client, ["opt-out-email", "opt-out-inapp", "default"]);

    expect(userMaySend(prefs.get("opt-out-email"), "recertification", "email")).toBe(false);
    expect(userMaySend(prefs.get("opt-out-email"), "recertification", "inApp")).toBe(true);
    expect(userMaySend(prefs.get("opt-out-inapp"), "recertification", "email")).toBe(true);
    expect(userMaySend(prefs.get("opt-out-inapp"), "recertification", "inApp")).toBe(false);
    expect(userMaySend(prefs.get("default"), "recertification", "email")).toBe(true);
    expect(userMaySend(prefs.get("default"), "recertification", "inApp")).toBe(true);
  });
});

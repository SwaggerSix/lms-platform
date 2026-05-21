import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Notification category keys that the settings UI exposes. Adding a new
 * category here is the only change needed when wiring a new emitter: add
 * the key, surface it in the settings panel, and call `userMaySend` from
 * the emitter.
 */
export type NotificationCategory =
  | "enrollment"
  | "due_dates"
  | "recertification"
  | "completions"
  | "certificate"
  | "discussions"
  | "announcements"
  | "digest";

export type Channel = "inApp" | "email";

export interface CategoryPref {
  inApp?: boolean;
  email?: boolean;
}

export type NotificationPrefs = Partial<Record<NotificationCategory, CategoryPref>>;

/**
 * Fetch raw notification preference blobs for a batch of users. Returns a
 * map keyed by user id. Users without any preference data are not in the
 * map — callers should treat that as "default to opt-in" via `userMaySend`.
 */
export async function fetchNotificationPrefs(
  service: SupabaseClient,
  userIds: string[]
): Promise<Map<string, NotificationPrefs>> {
  const result = new Map<string, NotificationPrefs>();
  if (userIds.length === 0) return result;

  const { data } = await service
    .from("users")
    .select("id, preferences")
    .in("id", userIds);

  for (const row of data ?? []) {
    const prefs = ((row as any).preferences ?? {}) as Record<string, unknown>;
    const raw = (prefs.notifications ?? {}) as Record<string, CategoryPref>;
    result.set((row as any).id, raw as NotificationPrefs);
  }
  return result;
}

/**
 * Check whether a given (category, channel) is allowed for the user.
 * Default is opt-in (true) — an opted-out user must have explicitly set
 * the flag to false. This means new users with empty preferences continue
 * receiving notifications until they actively turn them off.
 */
export function userMaySend(
  prefs: NotificationPrefs | undefined,
  category: NotificationCategory,
  channel: Channel
): boolean {
  if (!prefs) return true;
  const slot = prefs[category];
  if (!slot) return true;
  return slot[channel] !== false;
}

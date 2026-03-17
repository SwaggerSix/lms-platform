import { SupabaseClient } from "@supabase/supabase-js";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";

/**
 * Badge criteria shape stored in the badges.criteria JSONB column.
 *   { "type": "completions" | "enrollments" | "points" | "streak", "count": number }
 */
interface BadgeCriteria {
  type: "completions" | "enrollments" | "points" | "streak";
  count: number;
}

/**
 * Checks the user's current stats against every badge they haven't earned yet
 * and awards any newly qualified badges. For each new badge the user also
 * receives bonus points in the points_ledger.
 *
 * @returns An array of newly awarded badge rows (empty if none).
 */
export async function checkAndAwardBadges(
  supabase: SupabaseClient,
  userId: string
) {
  // ---- Gather user stats in parallel ----
  const [enrollments, completions, pointsRows, streakRows] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed"),
    supabase
      .from("points_ledger")
      .select("points")
      .eq("user_id", userId),
    supabase
      .from("points_ledger")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(365),
  ]);

  const totalEnrollments = enrollments.count ?? 0;
  const totalCompletions = completions.count ?? 0;
  const totalPoints = (pointsRows.data ?? []).reduce(
    (sum, p) => sum + (p.points ?? 0),
    0
  );

  // Calculate streak: consecutive days (from today backwards) with activity
  let currentStreak = 0;
  if (streakRows.data && streakRows.data.length > 0) {
    const daysWithActivity = new Set(
      streakRows.data.map((r) =>
        new Date(r.created_at).toISOString().split("T")[0]
      )
    );
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      if (daysWithActivity.has(key)) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // ---- Fetch all badges and the user's already-earned set ----
  const { data: allBadges } = await supabase.from("badges").select("*");
  const { data: userBadges } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId);

  const earnedIds = new Set((userBadges ?? []).map((b) => b.badge_id));

  // ---- Evaluate each badge the user hasn't earned yet ----
  const newBadges: typeof allBadges = [];

  for (const badge of allBadges ?? []) {
    if (earnedIds.has(badge.id)) continue;

    const criteria = badge.criteria as BadgeCriteria | null;
    if (!criteria || !criteria.type || criteria.count == null) continue;

    let earned = false;

    switch (criteria.type) {
      case "completions":
        earned = totalCompletions >= criteria.count;
        break;
      case "enrollments":
        earned = totalEnrollments >= criteria.count;
        break;
      case "points":
        earned = totalPoints >= criteria.count;
        break;
      case "streak":
        earned = currentStreak >= criteria.count;
        break;
    }

    if (earned) {
      // Insert the user_badge row
      const { error: badgeError } = await supabase
        .from("user_badges")
        .insert({ user_id: userId, badge_id: badge.id });

      if (badgeError) {
        // Likely a duplicate key (race condition) -- skip silently
        continue;
      }

      // Award bonus points for earning the badge
      const bonusPoints = 50;
      await supabase.from("points_ledger").insert({
        user_id: userId,
        action_type: "badge_earned",
        points: bonusPoints,
        reference_type: "badge",
        reference_id: badge.id,
      });

      // Fire webhook (non-blocking)
      dispatchWebhook("badge.earned", {
        user_id: userId,
        badge_name: badge.name,
      }).catch(() => {});

      newBadges!.push(badge);
    }
  }

  return newBadges ?? [];
}

/**
 * Insert a row into the points_ledger for the given user.
 */
export async function awardPoints(
  supabase: SupabaseClient,
  userId: string,
  points: number,
  actionType: string,
  referenceType?: string,
  referenceId?: string
) {
  const row: Record<string, unknown> = {
    user_id: userId,
    action_type: actionType,
    points,
  };
  if (referenceType) row.reference_type = referenceType;
  if (referenceId) row.reference_id = referenceId;

  const { error } = await supabase.from("points_ledger").insert(row);
  return { error };
}

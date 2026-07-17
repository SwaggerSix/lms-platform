import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import GamificationClient from "./gamification-client";
import type { PointRule, BadgeItem, LeaderboardUser } from "./gamification-client";
import { getResolvedPointRules, levelForPoints } from "@/lib/gamification/point-rules";

export const metadata: Metadata = {
  title: "Gamification | LMS Platform",
  description: "Configure point rules, badges, and leaderboard settings",
};

export default async function GamificationPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  // --- Fetch badges with awarded counts ---
  let badges: BadgeItem[] = [];
  try {
    const { data: badgeRows } = await service
      .from("badges")
      .select("*, user_badges(count)")
      .order("created_at", { ascending: true });

    badges = (badgeRows ?? []).map((row: any) => {
      const criteria = row.criteria ?? {};
      return {
        id: row.id,
        name: row.name,
        emoji: criteria.emoji ?? "\u{1F3C6}",
        color: criteria.color ?? "bg-gray-100",
        description: row.description ?? "",
        criteria: criteria.display_text ?? criteria.description ?? "",
        awardedCount: row.user_badges?.[0]?.count ?? 0,
      };
    });
  } catch {
    badges = [];
  }

  // --- Fetch leaderboard: aggregate points per user, join user info and badge counts ---
  let leaderboard: LeaderboardUser[] = [];
  try {
    // Aggregate every ledger row (paginated) so totals aren't truncated to the
    // most recent 500 entries.
    const PAGE = 1000;
    const pointsRows: any[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data: batch } = await service
        .from("points_ledger")
        .select("user_id, points, user:users(first_name, last_name)")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE - 1);
      const rows = batch ?? [];
      pointsRows.push(...rows);
      if (rows.length < PAGE) break;
    }

    // Aggregate total points per user
    const userPointsMap = new Map<string, { totalPoints: number; firstName: string; lastName: string }>();
    for (const row of (pointsRows ?? []) as any[]) {
      const userId = row.user_id as string;
      const existing = userPointsMap.get(userId);
      const firstName = row.user?.first_name ?? "";
      const lastName = row.user?.last_name ?? "";
      if (existing) {
        existing.totalPoints += row.points;
      } else {
        userPointsMap.set(userId, {
          totalPoints: row.points,
          firstName,
          lastName,
        });
      }
    }

    // Fetch badge counts per user
    const { data: badgeCounts } = await service
      .from("user_badges")
      .select("user_id, badge_id")
      .limit(500);

    const userBadgeCountMap = new Map<string, number>();
    for (const row of (badgeCounts ?? []) as any[]) {
      const userId = row.user_id as string;
      userBadgeCountMap.set(userId, (userBadgeCountMap.get(userId) ?? 0) + 1);
    }

    // Build sorted leaderboard
    const sorted = Array.from(userPointsMap.entries())
      .sort((a, b) => b[1].totalPoints - a[1].totalPoints)
      .slice(0, 10);

    leaderboard = sorted.map(([userId, data], index) => {
      const level = levelForPoints(data.totalPoints);
      const initials = `${(data.firstName || "?")[0]}${(data.lastName || "?")[0]}`.toUpperCase();
      return {
        rank: index + 1,
        name: `${data.firstName} ${data.lastName}`.trim() || "Unknown User",
        avatar: initials,
        level,
        totalPoints: data.totalPoints,
        badgesEarned: userBadgeCountMap.get(userId) ?? 0,
      };
    });
  } catch {
    leaderboard = [];
  }

  // --- Point rules: built-in defaults with any saved admin overrides applied ---
  const resolvedRules = await getResolvedPointRules(service);
  const pointRules: PointRule[] = resolvedRules.map((r) => ({
    id: r.key,
    key: r.key,
    action: r.action,
    points: r.points,
    description: r.description,
    enabled: r.enabled,
  }));

  return (
    <GamificationClient
      pointRulesData={pointRules}
      badges={badges}
      leaderboard={leaderboard}
    />
  );
}

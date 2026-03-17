import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GamificationClient from "./gamification-client";
import type { PointRule, BadgeItem, LeaderboardUser } from "./gamification-client";

export const metadata: Metadata = {
  title: "Gamification | LMS Platform",
  description: "Configure point rules, badges, and leaderboard settings",
};

const fallbackPointRules: PointRule[] = [
  { id: "1", action: "Course Completion", points: 100, description: "Awarded when a learner completes all modules in a course", enabled: true },
  { id: "2", action: "Quiz Pass", points: 50, description: "Awarded for passing a quiz with a score above the threshold", enabled: true },
  { id: "3", action: "Perfect Score", points: 25, description: "Bonus points for achieving 100% on any assessment", enabled: true },
  { id: "4", action: "Discussion Post", points: 10, description: "Awarded for contributing to course discussion forums", enabled: true },
  { id: "5", action: "Daily Login", points: 5, description: "Awarded once per day when a user logs into the platform", enabled: true },
  { id: "6", action: "Learning Streak (7-day)", points: 50, description: "Bonus for maintaining a 7-day consecutive learning streak", enabled: true },
  { id: "7", action: "Enrollment", points: 10, description: "Awarded when a learner enrolls in a new course", enabled: false },
  { id: "8", action: "Path Completion", points: 200, description: "Awarded when a learner completes an entire learning path", enabled: true },
];

export default async function GamificationPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: dbUser } = await supabase
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
    const { data: badgeRows } = await supabase
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
    const { data: pointsRows } = await supabase
      .from("points_ledger")
      .select("user_id, points, user:users(first_name, last_name)")
      .order("created_at", { ascending: false })
      .limit(500);

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
    const { data: badgeCounts } = await supabase
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
      const level = Math.floor(data.totalPoints / 500) + 1;
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

  // --- Point rules: use fallback since these are typically config-driven ---
  const pointRules = fallbackPointRules;

  return (
    <GamificationClient
      pointRulesData={pointRules}
      badges={badges}
      leaderboard={leaderboard}
    />
  );
}

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import GamificationClient from "./gamification-client";
import type { PointRule, BadgeItem, LeaderboardUser } from "./gamification-client";
import {
  getResolvedPointRules,
  levelForPoints,
  getPointsPerLevel,
} from "@/lib/gamification/point-rules";
import { resolveTenantForUser } from "@/lib/tenants/tenant-queries";

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

  // --- Fetch leaderboard: SQL aggregation over the full ledger, scoped to
  // the admin's tenant (super_admin sees platform-wide) ---
  const pointsPerLevel = await getPointsPerLevel(service);
  let leaderboard: LeaderboardUser[] = [];
  try {
    const tenantId = await resolveTenantForUser(dbUser.id, dbUser.role);
    const { data: lbRows } = await service.rpc("get_leaderboard", {
      p_tenant_id: tenantId,
      p_limit: 10,
    });

    leaderboard = ((lbRows ?? []) as any[]).map((row) => {
      const name = (row.display_name as string) || "Unknown User";
      const initials = name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
      return {
        rank: Number(row.rank),
        name,
        avatar: initials,
        level: levelForPoints(Number(row.total_points), pointsPerLevel),
        totalPoints: Number(row.total_points),
        badgesEarned: Number(row.badge_count),
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
      pointsPerLevel={pointsPerLevel}
    />
  );
}

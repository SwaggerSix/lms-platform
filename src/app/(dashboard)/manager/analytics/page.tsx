import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ManagerAnalyticsClient from "./manager-analytics-client";

export const metadata: Metadata = {
  title: "Team Analytics | LMS Platform",
  description: "Team risk overview and engagement trends for managers",
};

export default async function ManagerAnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser || !["admin", "manager"].includes(dbUser.role)) {
    redirect("/dashboard");
  }

  // Get direct reports
  const { data: teamMembers } = await service
    .from("users")
    .select("id, first_name, last_name, email, job_title")
    .eq("manager_id", dbUser.id)
    .eq("status", "active");

  const memberIds = (teamMembers ?? []).map((m: any) => m.id);

  // Get risk predictions for team
  let teamPredictions: any[] = [];
  if (memberIds.length > 0) {
    const { data } = await service
      .from("risk_predictions")
      .select(
        "*, user:users!risk_predictions_user_id_fkey(id, first_name, last_name), course:courses!risk_predictions_course_id_fkey(id, title)"
      )
      .in("user_id", memberIds)
      .order("risk_score", { ascending: false });
    teamPredictions = data ?? [];
  }

  // Get engagement snapshots for team (latest per user)
  let teamSnapshots: any[] = [];
  if (memberIds.length > 0) {
    const { data } = await service
      .from("learning_analytics_snapshots")
      .select("*")
      .in("user_id", memberIds)
      .order("snapshot_date", { ascending: false })
      .limit(memberIds.length * 30);

    teamSnapshots = data ?? [];
  }

  // Build per-member summary
  const memberSummaries = (teamMembers ?? []).map((member: any) => {
    const predictions = teamPredictions.filter((p: any) => p.user_id === member.id);
    const snapshots = teamSnapshots.filter((s: any) => s.user_id === member.id);
    const latestSnapshot = snapshots[0];

    const highestRisk = predictions.length > 0
      ? predictions.reduce((max: any, p: any) =>
          parseFloat(p.risk_score) > parseFloat(max.risk_score) ? p : max
        )
      : null;

    return {
      id: member.id,
      name: `${member.first_name} ${member.last_name}`,
      email: member.email,
      jobTitle: member.job_title,
      engagementScore: latestSnapshot ? parseFloat(latestSnapshot.engagement_score) : 0,
      avgProgress: latestSnapshot ? parseFloat(latestSnapshot.avg_progress) : 0,
      coursesEnrolled: latestSnapshot?.courses_enrolled ?? 0,
      coursesCompleted: latestSnapshot?.courses_completed ?? 0,
      loginStreak: latestSnapshot?.login_streak ?? 0,
      riskLevel: highestRisk?.risk_level ?? "low",
      riskScore: highestRisk ? parseFloat(highestRisk.risk_score) : 0,
      riskCourse: highestRisk?.course?.title ?? null,
      recentSnapshots: snapshots.slice(0, 14).reverse(),
    };
  });

  return (
    <ManagerAnalyticsClient
      teamMembers={memberSummaries}
      totalTeam={memberIds.length}
    />
  );
}

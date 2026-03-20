import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import PredictiveAnalyticsClient from "./predictive-client";

export const metadata: Metadata = {
  title: "Predictive Analytics | LMS Platform",
  description: "At-risk learner dashboard with risk heatmap, alerts, and intervention recommendations",
};

export default async function PredictiveAnalyticsPage() {
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

  // Get at-risk learners
  const { data: riskPredictions } = await service
    .from("risk_predictions")
    .select(
      "*, user:users!risk_predictions_user_id_fkey(id, first_name, last_name, email), course:courses!risk_predictions_course_id_fkey(id, title, slug)"
    )
    .in("risk_level", ["high", "critical"])
    .order("risk_score", { ascending: false })
    .limit(50);

  // Get all predictions for heatmap
  const { data: allPredictions } = await service
    .from("risk_predictions")
    .select("risk_level, risk_score, computed_at")
    .order("computed_at", { ascending: false })
    .limit(500);

  // Get recent alerts
  const { data: alerts } = await service
    .from("analytics_alerts")
    .select(
      "*, user:users!analytics_alerts_user_id_fkey(first_name, last_name, email), course:courses!analytics_alerts_course_id_fkey(title)"
    )
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(30);

  // Risk distribution
  const distribution = {
    low: (allPredictions ?? []).filter((p: any) => p.risk_level === "low").length,
    medium: (allPredictions ?? []).filter((p: any) => p.risk_level === "medium").length,
    high: (allPredictions ?? []).filter((p: any) => p.risk_level === "high").length,
    critical: (allPredictions ?? []).filter((p: any) => p.risk_level === "critical").length,
  };

  const avgRiskScore =
    allPredictions && allPredictions.length > 0
      ? (
          allPredictions.reduce(
            (sum: number, p: any) => sum + parseFloat(p.risk_score),
            0
          ) / allPredictions.length
        ).toFixed(1)
      : "0";

  return (
    <PredictiveAnalyticsClient
      atRiskLearners={(riskPredictions ?? []).map((r: any) => {
        const u = r.user as any;
        const c = r.course as any;
        return {
          userId: r.user_id,
          userName: u ? `${u.first_name} ${u.last_name}` : "Unknown",
          email: u?.email ?? "",
          courseId: r.course_id,
          courseTitle: c?.title ?? "Unknown",
          riskLevel: r.risk_level,
          riskScore: parseFloat(r.risk_score),
          factors: r.factors ?? {},
          recommendedActions: r.recommended_actions ?? [],
          computedAt: r.computed_at,
        };
      })}
      alerts={alerts ?? []}
      distribution={distribution}
      avgRiskScore={avgRiskScore}
      totalPredictions={allPredictions?.length ?? 0}
    />
  );
}

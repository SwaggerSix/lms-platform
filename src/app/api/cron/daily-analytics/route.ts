import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createDailySnapshot } from "@/lib/analytics/snapshots";
import { calculateRiskScore } from "@/lib/analytics/predictive";
import { withCronMonitoring } from "@/lib/cron/monitor";

/**
 * Cron endpoint: compute daily snapshots and risk predictions for all active users.
 * Should be called by a cron job (e.g., Vercel Cron) with the CRON_SECRET header.
 */
// Vercel Cron calls GET; also support POST for manual triggers
export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await withCronMonitoring("daily-analytics", async () => {
      const service = createServiceClient();
      const counters = { snapshots: 0, predictions: 0, errors: 0 };

      // Get all active users
      const { data: users } = await service
        .from("users")
        .select("id")
        .eq("status", "active")
        .limit(5000);

      if (!users || users.length === 0) {
        return { ...counters, records_processed: 0 };
      }

      // Process in batches of 50
      const batchSize = 50;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);

        await Promise.allSettled(
          batch.map(async (user: any) => {
            try {
              // Create daily snapshot
              await createDailySnapshot(user.id);
              counters.snapshots++;

              // Get active enrollments and compute risk for each
              const { data: enrollments } = await service
                .from("enrollments")
                .select("course_id")
                .eq("user_id", user.id)
                .eq("status", "active");

              for (const enrollment of enrollments ?? []) {
                try {
                  const prediction = await calculateRiskScore(
                    user.id,
                    enrollment.course_id
                  );

                  // Upsert prediction
                  await service.from("risk_predictions").upsert(
                    {
                      user_id: prediction.userId,
                      course_id: prediction.courseId,
                      risk_level: prediction.riskLevel,
                      risk_score: prediction.riskScore,
                      factors: prediction.factors,
                      recommended_actions: prediction.recommendedActions,
                      computed_at: new Date().toISOString(),
                    },
                    { onConflict: "user_id,course_id", ignoreDuplicates: false }
                  );

                  counters.predictions++;

                  // Create alert if high/critical risk
                  if (
                    prediction.riskLevel === "high" ||
                    prediction.riskLevel === "critical"
                  ) {
                    const alertType =
                      prediction.riskLevel === "critical"
                        ? "at_risk"
                        : "behind_schedule";

                    // Check if similar alert exists recently
                    const { data: recentAlert } = await service
                      .from("analytics_alerts")
                      .select("id")
                      .eq("user_id", user.id)
                      .eq("course_id", enrollment.course_id)
                      .eq("alert_type", alertType)
                      .gte(
                        "created_at",
                        new Date(Date.now() - 7 * 86400000).toISOString()
                      )
                      .limit(1);

                    if (!recentAlert || recentAlert.length === 0) {
                      await service.from("analytics_alerts").insert({
                        user_id: user.id,
                        course_id: enrollment.course_id,
                        alert_type: alertType,
                        message: `Risk score: ${prediction.riskScore}. ${prediction.recommendedActions[0] ?? "Review learner progress."}`,
                      });
                    }
                  }
                } catch {
                  counters.errors++;
                }
              }
            } catch {
              counters.errors++;
            }
          })
        );
      }

      return {
        ...counters,
        records_processed: users.length,
      };
    });

    return NextResponse.json({
      message: "Daily analytics computed",
      results,
    });
  } catch (err) {
    console.error("Daily analytics cron error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

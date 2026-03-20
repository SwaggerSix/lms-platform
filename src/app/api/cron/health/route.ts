import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { checkCronHealth } from "@/lib/cron/monitor";

/**
 * GET /api/cron/health
 *
 * Returns the health status of all known cron jobs.
 * Admin-only endpoint — requires authenticated admin user.
 *
 * Also accepts CRON_SECRET for automated monitoring systems.
 */
export async function GET(request: NextRequest) {
  // Allow access via admin session OR cron secret (for external monitoring)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuth) {
    const auth = await authorize("admin");
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
  }

  try {
    const health = await checkCronHealth();

    const status = health.alerts.length > 0 ? "degraded" : "healthy";

    return NextResponse.json({
      status,
      checked_at: new Date().toISOString(),
      jobs: health.jobs,
      alerts: health.alerts,
      alert_count: health.alerts.length,
    });
  } catch (err) {
    console.error("Cron health check error:", err);
    return NextResponse.json(
      { error: "Failed to check cron health" },
      { status: 500 }
    );
  }
}

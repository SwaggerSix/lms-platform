import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { checkCronHealth } from "@/lib/cron/monitor";
import { jsonCached } from "@/lib/api/cached";

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

    // Short TTL so tab refreshes don't re-run the per-job cron_runs
    // queries but a polling UI still sees fresh data within 10s.
    // Vary includes Authorization (in addition to Cookie) because this
    // endpoint accepts dual auth — session cookie OR CRON_SECRET
    // bearer — and a cache must key on whichever identity is in play.
    return jsonCached(
      {
        status,
        checked_at: new Date().toISOString(),
        jobs: health.jobs,
        alerts: health.alerts,
        alert_count: health.alerts.length,
      },
      { maxAge: 10, swr: 20, varyExtra: ["Authorization"] }
    );
  } catch (err) {
    console.error("Cron health check error:", err);
    return NextResponse.json(
      { error: "Failed to check cron health" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { checkCronHealth, logCronRun } from "@/lib/cron/monitor";
import { jsonNoStore } from "@/lib/api/no-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handler(request);
}
export async function POST(request: NextRequest) {
  return handler(request);
}

/**
 * Cron: run checkCronHealth() on a fixed cadence so the alert webhook
 * (CRON_ALERT_WEBHOOK_URL) fires even when nobody is actively viewing
 * /admin/cron-health. Calls the helper directly — no HTTP round-trip to
 * /api/cron/health — to avoid a self-loop and so the cron secret check
 * isn't required twice.
 *
 * Records its own run in cron_runs so it shows up alongside the other
 * jobs on /admin/cron-health (and so a failure of the self-check is
 * itself a critical event).
 */
async function handler(request: NextRequest) {
  const startedAt = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const health = await checkCronHealth();
    await logCronRun({
      job_name: "self-check",
      status: "success",
      duration_ms: Date.now() - startedAt,
      records_processed: health.jobs.length,
    });
    return jsonNoStore({
      status: health.alerts.length > 0 ? "degraded" : "healthy",
      jobs_checked: health.jobs.length,
      alert_count: health.alerts.length,
    });
  } catch (err) {
    await logCronRun({
      job_name: "self-check",
      status: "failure",
      duration_ms: Date.now() - startedAt,
      records_processed: 0,
      error_message: err instanceof Error ? err.message : String(err),
    });
    return jsonNoStore(
      { error: err instanceof Error ? err.message : "self-check failed" },
      { status: 500 }
    );
  }
}

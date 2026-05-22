import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { estimateIntervalMinutes } from "@/lib/cron/monitor";
import { readVercelConfig, vercelConfigCacheInfo } from "@/lib/cron/vercel-config";
import { readThresholdsConfig, thresholdsConfigCacheInfo } from "@/lib/cron/thresholds-config";

/**
 * GET /api/admin/alert-config
 *
 * Returns:
 *   - alert_webhook: sanitized cron-thresholds.json alert_webhook block
 *   - consecutive_failures: cron-thresholds.json consecutive_failures
 *   - replay: cron-thresholds.json replay block
 *   - schedules: each cron from vercel.json with its raw schedule and
 *     the parser's interval-in-minutes estimate. Lets admins eyeball
 *     "what's configured to run" vs "what's actually running" (the
 *     latter shown on /admin/cron-health).
 *   - has_webhook_url / has_pagerduty_routing_key: env booleans
 *
 * Secrets themselves are never returned.
 */
export async function GET() {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const thresholds = readThresholdsConfig();

  // Parse vercel.json's cron entries so the UI can diff configured vs
  // actual run history. Each entry: { name, path, schedule,
  // interval_minutes (heuristic from cron-parser) }.
  const vcfg = readVercelConfig();
  const schedules = (vcfg.crons ?? []).map((c) => {
    const name = (c.path ?? "").split("/").pop() ?? "";
    return {
      name,
      path: c.path,
      schedule: c.schedule,
      interval_minutes: estimateIntervalMinutes(c.schedule),
    };
  });

  return NextResponse.json(
    {
      alert_webhook: (thresholds.alert_webhook ?? null) as Record<string, unknown> | null,
      consecutive_failures: (thresholds.consecutive_failures ?? null) as Record<string, unknown> | null,
      replay: (thresholds.replay ?? null) as Record<string, unknown> | null,
      thresholds_cache: thresholdsConfigCacheInfo(),
      schedules,
      schedules_cache: vercelConfigCacheInfo(),
      has_webhook_url: !!process.env.CRON_ALERT_WEBHOOK_URL,
      has_pagerduty_routing_key: !!process.env.PAGERDUTY_ROUTING_KEY,
    },
    {
      headers: {
        // Config is admin-only and changes rarely. Allow private (the
        // admin's browser) caching for 30s so a tab refresh doesn't
        // re-stat the files; revalidate=60s lets stale-while-revalidate
        // proxies (none in this stack today, but future CDN setups
        // benefit) serve a 60s-old response while fetching fresh.
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        Vary: "Cookie",
      },
    }
  );
}

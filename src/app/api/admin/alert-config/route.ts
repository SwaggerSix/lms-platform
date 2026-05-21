import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { estimateIntervalMinutes } from "@/lib/cron/monitor";

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

  let thresholds: Record<string, unknown> = {};
  try {
    const p = join(process.cwd(), "cron-thresholds.json");
    if (existsSync(p)) {
      thresholds = JSON.parse(readFileSync(p, "utf8"));
    }
  } catch {
    // missing / malformed → empty config
  }

  // Parse vercel.json's cron entries so the UI can diff configured vs
  // actual run history. Each entry: { name, path, schedule,
  // interval_minutes (heuristic from cron-parser) }.
  let schedules: Array<{ name: string; path: string; schedule: string; interval_minutes: number }> = [];
  try {
    const vp = join(process.cwd(), "vercel.json");
    if (existsSync(vp)) {
      const vcfg = JSON.parse(readFileSync(vp, "utf8")) as {
        crons?: Array<{ path: string; schedule: string }>;
      };
      schedules = (vcfg.crons ?? []).map((c) => {
        const name = (c.path ?? "").split("/").pop() ?? "";
        return {
          name,
          path: c.path,
          schedule: c.schedule,
          interval_minutes: estimateIntervalMinutes(c.schedule),
        };
      });
    }
  } catch {
    // missing / malformed vercel.json → empty schedules list
  }

  return NextResponse.json({
    alert_webhook: (thresholds.alert_webhook ?? null) as Record<string, unknown> | null,
    consecutive_failures: (thresholds.consecutive_failures ?? null) as Record<string, unknown> | null,
    replay: (thresholds.replay ?? null) as Record<string, unknown> | null,
    schedules,
    has_webhook_url: !!process.env.CRON_ALERT_WEBHOOK_URL,
    has_pagerduty_routing_key: !!process.env.PAGERDUTY_ROUTING_KEY,
  });
}

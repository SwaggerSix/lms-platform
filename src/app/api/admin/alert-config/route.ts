import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * GET /api/admin/alert-config
 *
 * Returns the parsed cron-thresholds.json with two flags resolved from
 * env so the UI can show the operator the current dispatch state:
 *   - has_webhook_url: whether CRON_ALERT_WEBHOOK_URL is set
 *   - has_pagerduty_routing_key: whether PAGERDUTY_ROUTING_KEY is set
 *
 * Secrets themselves are never returned.
 */
export async function GET() {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let config: Record<string, unknown> = {};
  try {
    const p = join(process.cwd(), "cron-thresholds.json");
    if (existsSync(p)) {
      config = JSON.parse(readFileSync(p, "utf8"));
    }
  } catch {
    // missing / malformed → empty config
  }

  return NextResponse.json({
    alert_webhook: (config.alert_webhook ?? null) as Record<string, unknown> | null,
    consecutive_failures: (config.consecutive_failures ?? null) as Record<string, unknown> | null,
    has_webhook_url: !!process.env.CRON_ALERT_WEBHOOK_URL,
    has_pagerduty_routing_key: !!process.env.PAGERDUTY_ROUTING_KEY,
  });
}

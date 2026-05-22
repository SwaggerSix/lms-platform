import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withCronMonitoring } from "@/lib/cron/monitor";
import { jsonNoStore } from "@/lib/api/no-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handler(request);
}
export async function POST(request: NextRequest) {
  return handler(request);
}

/**
 * Cron: refresh the notification_audit_rule_summary materialized view.
 *
 * The audit page exposes a manual refresh button, but admins shouldn't have
 * to babysit it — a daily refresh keeps the all-time aggregation reasonably
 * fresh without putting load on the page request path.
 */
async function handler(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await withCronMonitoring("refresh-audit-view", async () => {
      const service = createServiceClient();
      const { error: concErr } = await service.rpc("notification_audit_refresh_concurrent");
      if (!concErr) {
        return { concurrent: true, records_processed: 1 };
      }
      const { error: plainErr } = await service.rpc("notification_audit_refresh_plain");
      if (plainErr) {
        throw new Error(`Refresh failed (concurrent: ${concErr.message}; plain: ${plainErr.message})`);
      }
      return { concurrent: false, records_processed: 1 };
    });
    return jsonNoStore({ ok: true, ...result });
  } catch (err) {
    return jsonNoStore(
      { error: err instanceof Error ? err.message : "refresh failed" },
      { status: 500 }
    );
  }
}

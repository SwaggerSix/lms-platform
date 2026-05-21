import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // Try CONCURRENT refresh first (requires the unique index from migration
  // 20260318100035); fall back to a plain refresh if the index is missing.
  const { error: concErr } = await service.rpc("notification_audit_refresh_concurrent");
  if (!concErr) {
    return NextResponse.json({ ok: true, concurrent: true });
  }

  const { error: plainErr } = await service.rpc("notification_audit_refresh_plain");
  if (plainErr) {
    return NextResponse.json(
      { error: "refresh failed", detail: plainErr.message, concurrent_error: concErr.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, concurrent: false });
}

import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { gatherReconciliation } from "@/lib/integrations/qb-reconcile";

// Always hits the DB (live reconciliation summary); never statically cached.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/qb-sync-status — QuickBooks sync health summary for ops/admin.
 *
 * Same reconciliation summary the daily cron computes (queue status counts,
 * stale leases, error/stuck orders & payouts, best-effort revenue tie-out), so
 * an admin UI / on-call can poll it on demand. Admin-authorized via the repo's
 * `authorize()` (session + role check) — NOT the Bridge bearer token. Read-only.
 */
export async function GET() {
  const auth = await authorize("admin", "super_admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const service = createServiceClient();
    const summary = await gatherReconciliation(service);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("QB sync-status endpoint error:", err);
    return NextResponse.json({ error: "Failed to compute QB sync status" }, { status: 500 });
  }
}

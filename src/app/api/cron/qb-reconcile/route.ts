import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withCronMonitoring } from "@/lib/cron/monitor";
import { gatherReconciliation } from "@/lib/integrations/qb-reconcile";

/**
 * Cron endpoint: reconcile the QuickBooks sync pipeline and surface drift.
 *
 * Runs daily. Inspects qb_sync_queue (status counts + stale `in_progress`
 * leases the Bridge may have dropped), orders / instructor_payouts in error or
 * stuck-unsynced, and a best-effort revenue tie-out for the trailing window.
 * The summary is logged via withCronMonitoring (cron_runs table) and returned
 * as JSON. This NEVER mutates anything — it only reports.
 *
 * Called by Vercel Cron (GET) with the CRON_SECRET bearer header; POST is also
 * accepted for manual triggers.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await withCronMonitoring("qb-reconcile", async () => {
      const service = createServiceClient();
      const result = await gatherReconciliation(service);

      // Structured log so the drift is visible in cron output even when nobody
      // is polling the admin endpoint.
      if (result.flagged) {
        console.warn("[qb-reconcile] DRIFT detected:", JSON.stringify({
          alerts: result.alerts,
          queue: result.queue.counts,
          staleInProgressIds: result.queue.staleInProgressIds,
          queueErrorIds: result.queue.errorIds,
          orderErrorIds: result.orders.errorIds,
          orderStuckIds: result.orders.stuckIds,
          payoutErrorIds: result.payouts.errorIds,
          payoutStuckIds: result.payouts.stuckIds,
          money: result.money,
        }));
      } else {
        console.info("[qb-reconcile] clean:", JSON.stringify({ queue: result.queue.counts }));
      }

      // records_processed = total rows the queue scan covered, for cron_runs.
      return { ...result, records_processed: result.queue.total };
    });

    return NextResponse.json({ message: "QB reconciliation complete", summary });
  } catch (err) {
    console.error("QB reconcile cron error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

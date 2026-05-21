import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { dispatchAlertWebhook } from "@/lib/cron/monitor";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/admin/cron-alert-replay
 * Body: { hours?: number (default 24, max 168) }
 *
 * Reconstructs an alert payload from the last N hours of cron_runs
 * failures and re-dispatches it via the configured alert webhook. For
 * use when the on-call missed alerts (webhook outage, channel
 * misconfigured, etc.) and needs to see what would have fired.
 *
 * Does NOT modify state. The dispatcher's existing severity / adapter
 * config applies, including dry_run if it's enabled.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let hours = 24;
  try {
    const body = await request.json().catch(() => ({}));
    const requested = Number(body?.hours);
    if (Number.isFinite(requested) && requested > 0) {
      hours = Math.min(168, Math.floor(requested));
    }
  } catch {
    // empty / malformed body → use default
  }

  const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const service = createServiceClient();
  const { data: failureRows, error } = await service
    .from("cron_runs")
    .select("job_name, status, error_message, created_at")
    .eq("status", "failure")
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const failures = (failureRows ?? []) as any[];
  if (failures.length === 0) {
    return NextResponse.json({
      ok: true,
      replayed_alerts: 0,
      hours,
      message: "No failures in the requested window — nothing to replay.",
    });
  }

  // Build a synthetic alerts[] from the failure rows. We tag everything
  // critical so the dispatcher's default min_severity=critical filter
  // doesn't drop them — the operator explicitly asked to replay these.
  const alerts = failures.map((f) =>
    `${f.job_name} [critical]: replayed failure at ${f.created_at}${f.error_message ? ` — ${f.error_message.slice(0, 200)}` : ""}`
  );

  // Build a minimal jobs[] from the unique job names seen.
  const seen = new Set<string>();
  const jobs = [] as Array<{ name: string; last_run: string; status: string }>;
  for (const f of failures) {
    if (seen.has(f.job_name)) continue;
    seen.add(f.job_name);
    jobs.push({ name: f.job_name, last_run: f.created_at, status: "failure" });
  }

  await dispatchAlertWebhook({
    status: "degraded",
    checked_at: new Date().toISOString(),
    jobs,
    alerts,
  });

  logAudit({
    userId: auth.user?.id,
    action: "replay.cron_alerts",
    entityType: "cron_alert_replay",
    newValues: {
      hours,
      replayed_alerts: alerts.length,
      affected_jobs: jobs.map((j) => j.name),
    },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    replayed_alerts: alerts.length,
    hours,
    affected_jobs: jobs.map((j) => j.name),
  });
}

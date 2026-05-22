import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { dispatchAlertWebhook } from "@/lib/cron/monitor";
import { cronJobBasenames } from "@/lib/cron/vercel-config";
import { getReplayDedupMinutes } from "@/lib/cron/thresholds-config";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/admin/cron-alert-replay
 * Body: {
 *   hours?: number (default 24, max 168),
 *   job?: string | string[] (default all jobs),
 *   force?: boolean
 * }
 *
 * Reconstructs an alert payload from the last N hours of cron_runs
 * failures and re-dispatches it via the configured alert webhook. For
 * use when the on-call missed alerts (webhook outage, channel
 * misconfigured, etc.) and needs to see what would have fired.
 *
 * Scope: when `job` is omitted, every failed cron_runs row in the
 * window contributes. When `job` is a string or array, only rows for
 * those job_names are replayed — lets the operator re-dispatch a
 * single noisy job's alerts without re-firing everything else.
 *
 * Idempotency: suppresses repeat replays within
 * cron-thresholds.json's replay.dedup_minutes window (default 5).
 * Pass { force: true } to override.
 *
 * Does NOT modify state beyond writing an audit_logs entry. The
 * dispatcher's existing severity / adapter config applies, including
 * dry_run if it's enabled.
 */

/**
 * Returns the configured replay-suppression window in minutes.
 * Semantics:
 *   - 0 (explicit zero in config): idempotency is fully disabled.
 *     Operator-acknowledged "I want every click to fire."
 *   - undefined / missing key / negative / non-numeric: defaults to 5.
 *   - positive integer: use as-is.
 */
/** Standard response options for every branch: replay is side-effectful
 * so caching is wrong on success AND on error (an admin retrying after a
 * 429 must not see a stale 200 from a proxy). `private` layered with
 * `no-store` is the most defensive combination — some older proxies
 * misread no-store alone. */
const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, ...NO_STORE });
  }

  let hours = 24;
  let force = false;
  let jobFilter: string[] | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    const requested = Number(body?.hours);
    if (Number.isFinite(requested) && requested > 0) {
      hours = Math.min(168, Math.floor(requested));
    }
    force = body?.force === true;
    if (typeof body?.job === "string") {
      jobFilter = [body.job];
    } else if (Array.isArray(body?.job)) {
      jobFilter = (body.job as unknown[]).map(String).filter(Boolean);
      if (jobFilter.length === 0) jobFilter = null;
    }
  } catch {
    // empty / malformed body → use defaults
  }


  const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const service = createServiceClient();

  // Validate the job filter against the set of jobs we recognize:
  // - distinct job_names from cron_runs over the last 30 days
    //   (jobs that have actually fired recently), plus
  // - vercel.json cron path basenames (jobs that are scheduled but
  //   may not have run yet, e.g. a freshly-deployed cron).
  // The union avoids false-positive rejection for brand-new crons.
  if (jobFilter && jobFilter.length > 0) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: known } = await service
      .from("cron_runs")
      .select("job_name")
      .gte("created_at", since);
    const knownSet = new Set(((known ?? []) as any[]).map((r) => r.job_name));

    // Augment from vercel.json (cached in-process via readVercelConfig).
    for (const name of cronJobBasenames()) knownSet.add(name);

    const unknown = jobFilter.filter((j) => !knownSet.has(j));
    if (unknown.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unknown job(s)",
          unknown_jobs: unknown,
          known_jobs: Array.from(knownSet).sort(),
        },
        { status: 400, ...NO_STORE }
      );
    }
  }

  // Audit action: per-job replays get a job-specific suffix so reporting
  // can split them out from global replays (and from each other).
  //   - global / multi-job → "replay.cron_alerts"
  //   - single job        → "replay.cron_alerts.<job_name>"
  const auditAction =
    jobFilter && jobFilter.length === 1 ? `replay.cron_alerts.${jobFilter[0]}` : "replay.cron_alerts";

  // Idempotency check: look for a recent successful replay in audit_logs
  // *with the same action* — so global suppresses only global, and a
  // per-job suppression doesn't lock out other jobs' replays.
  const dedupMinutes = getReplayDedupMinutes();
  if (!force && dedupMinutes > 0) {
    const sinceIso = new Date(Date.now() - dedupMinutes * 60 * 1000).toISOString();
    const { data: recent } = await service
      .from("audit_logs")
      .select("id, created_at")
      .eq("action", auditAction)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1);
    if (recent && recent.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          reason: "replay_recently_fired",
          last_replay_at: (recent[0] as any).created_at,
          dedup_minutes: dedupMinutes,
          dedup_scope: auditAction,
          message: `A replay (${auditAction}) fired in the last ${dedupMinutes} minute${dedupMinutes === 1 ? "" : "s"}. Pass { "force": true } to override.`,
        },
        { status: 429, ...NO_STORE }
      );
    }
  }

  let failureQuery = service
    .from("cron_runs")
    .select("job_name, status, error_message, created_at")
    .eq("status", "failure")
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(500);
  if (jobFilter && jobFilter.length > 0) {
    failureQuery = failureQuery.in("job_name", jobFilter);
  }
  const { data: failureRows, error } = await failureQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, ...NO_STORE });
  }

  const failures = (failureRows ?? []) as any[];
  if (failures.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        replayed_alerts: 0,
        hours,
        job_filter: jobFilter,
        message: jobFilter
          ? `No failures for ${jobFilter.join(", ")} in the requested window — nothing to replay.`
          : "No failures in the requested window — nothing to replay.",
      },
      NO_STORE
    );
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
    action: auditAction,
    entityType: "cron_alert_replay",
    newValues: {
      hours,
      job_filter: jobFilter,
      replayed_alerts: alerts.length,
      affected_jobs: jobs.map((j) => j.name),
    },
  }).catch(() => {});

  return NextResponse.json(
    {
      ok: true,
      replayed_alerts: alerts.length,
      hours,
      job_filter: jobFilter,
      affected_jobs: jobs.map((j) => j.name),
    },
    NO_STORE
  );
}

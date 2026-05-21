import { createServiceClient } from "@/lib/supabase/service";

// ─── Types ───────────────────────────────────────────────────────

export interface CronRunLog {
  job_name: string;
  status: "success" | "failure";
  duration_ms: number;
  records_processed: number;
  error_message?: string;
}

export interface CronJobHealth {
  name: string;
  last_run: string;
  status: string;
}

export interface CronHealthReport {
  jobs: CronJobHealth[];
  alerts: string[];
}

// ─── Expected schedules for known cron jobs (in minutes) ────────
//
// Sourced from vercel.json at module load so the list can't drift from
// the actual scheduler config. Falls back to a small hard-coded map if
// the file can't be read (test envs, etc.) so monitor stays functional.

const FALLBACK_INTERVALS: Record<string, number> = {
  "daily-analytics": 24 * 60,
  "enrollment-rules": 60,
  "compute-recommendations": 24 * 60,
  "scheduled-reports": 60,
  "curriculum-review-alerts": 24 * 60,
  "compliance-recurrence": 24 * 60,
  "refresh-audit-view": 24 * 60,
  "self-check": 6 * 60,
};

/**
 * Compute the interval (in minutes) between successive runs of a
 * standard cron expression. Uses cron-parser to handle the full
 * vixie-cron grammar (lists, ranges, step values, named months/days),
 * which the previous bespoke parser couldn't. Falls back to 24h on any
 * parse error so monitor stays functional with malformed input.
 */
export function estimateIntervalMinutes(expr: string): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CronExpressionParser } = require("cron-parser") as typeof import("cron-parser");
    const it = CronExpressionParser.parse(expr);
    const a = it.next().toDate().getTime();
    const b = it.next().toDate().getTime();
    return Math.max(1, Math.round((b - a) / 60000));
  } catch {
    return 24 * 60;
  }
}

function loadIntervalsFromVercelJson(): Record<string, number> | null {
  try {
    // Lazy require so this never runs in browser/Edge contexts.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const cfgPath = path.join(process.cwd(), "vercel.json");
    if (!fs.existsSync(cfgPath)) return null;
    const raw = fs.readFileSync(cfgPath, "utf8");
    const cfg = JSON.parse(raw) as { crons?: { path: string; schedule: string }[] };
    if (!Array.isArray(cfg.crons)) return null;
    const result: Record<string, number> = {};
    for (const entry of cfg.crons) {
      const name = (entry.path ?? "").split("/").pop() ?? "";
      if (!name) continue;
      result[name] = estimateIntervalMinutes(entry.schedule);
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

const EXPECTED_INTERVALS: Record<string, number> = loadIntervalsFromVercelJson() ?? FALLBACK_INTERVALS;

interface JobThresholds {
  warn_minutes?: number;
  critical_minutes?: number;
}

interface CronAlertConfig {
  alert_webhook?: {
    adapter?: "generic" | "slack" | "pagerduty";
    min_severity?: "warn" | "critical";
  };
  consecutive_failures?: { window?: number; threshold?: number };
  thresholds?: Record<string, JobThresholds>;
}

/**
 * Optional per-job alert thresholds from cron-thresholds.json at the repo
 * root. Falls back to 2× expected (warn) and 4× expected (critical) when a
 * job isn't listed.
 */
function loadAlertConfig(): CronAlertConfig {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const p = path.join(process.cwd(), "cron-thresholds.json");
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as CronAlertConfig;
  } catch {
    return {};
  }
}

const ALERT_CONFIG = loadAlertConfig();
const JOB_THRESHOLDS: Record<string, JobThresholds> = ALERT_CONFIG.thresholds ?? {};

/** POST the alert payload to CRON_ALERT_WEBHOOK_URL when alerts fire and
 * severity meets the configured min_severity. Fire-and-forget, never throws.
 * Payload shape depends on the configured adapter:
 *   - "generic" (default): { status, checked_at, alerts, all_alerts, jobs }
 *   - "slack": Incoming-Webhook compatible { text, blocks } with mrkdwn
 *   - "pagerduty": Events API v2 routing-key payload (requires
 *     PAGERDUTY_ROUTING_KEY env var; CRON_ALERT_WEBHOOK_URL should be
 *     https://events.pagerduty.com/v2/enqueue)
 */
export async function dispatchAlertWebhook(payload: {
  status: "healthy" | "degraded";
  checked_at: string;
  jobs: CronJobHealth[];
  alerts: string[];
}): Promise<void> {
  const url = process.env.CRON_ALERT_WEBHOOK_URL;
  if (!url) return;

  const adapter = ALERT_CONFIG.alert_webhook?.adapter ?? "generic";

  // Healthy path: only PagerDuty cares — emit a resolve event so any
  // open incident clears. Slack/generic stay quiet on healthy checks
  // because we don't want to spam channels with "still fine" messages.
  if (payload.status === "healthy" || payload.alerts.length === 0) {
    if (adapter !== "pagerduty") return;
    const resolveBody = buildAlertBody("pagerduty", payload, []);
    if (!resolveBody) return;
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resolveBody),
      });
    } catch (err) {
      console.error("Cron alert webhook (resolve) failed:", err);
    }
    return;
  }

  const minSev = ALERT_CONFIG.alert_webhook?.min_severity ?? "critical";
  const wantsCritical = minSev === "critical";
  const matching = payload.alerts.filter((a) =>
    wantsCritical ? /\[critical\]/.test(a) : /\[(critical|warn)\]/.test(a)
  );
  if (matching.length === 0) return;

  const body = buildAlertBody(adapter, payload, matching);
  if (!body) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Cron alert webhook failed:", err);
  }
}

export function buildAlertBody(
  adapter: "generic" | "slack" | "pagerduty",
  payload: { status: string; checked_at: string; jobs: CronJobHealth[]; alerts: string[] },
  matching: string[]
): Record<string, unknown> | null {
  if (adapter === "slack") {
    // Slack Incoming Webhook payload. Bullets render with the trailing
    // newline; markdown is preserved in `text` and the first block.
    // Per https://api.slack.com/reference/surfaces/formatting#escaping
    // the three required escapes are &, <, >. Job names and alert
    // strings are user-controlled (config + DB) so escape defensively.
    const escapeMrkdwn = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeStatus = escapeMrkdwn(payload.status);
    const safeMatching = matching.map(escapeMrkdwn);
    const summary = `LMS cron health *${safeStatus}* — ${safeMatching.length} alert${safeMatching.length === 1 ? "" : "s"}`;
    const detail = safeMatching.map((a) => `• ${a}`).join("\n");
    return {
      text: `${summary}\n${detail}`,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: `*${summary}*` } },
        { type: "section", text: { type: "mrkdwn", text: detail } },
        { type: "context", elements: [{ type: "mrkdwn", text: `_checked ${escapeMrkdwn(payload.checked_at)}_` }] },
      ],
    };
  }

  if (adapter === "pagerduty") {
    const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
    if (!routingKey) {
      console.error("PAGERDUTY_ROUTING_KEY not set — skipping PagerDuty alert");
      return null;
    }
    // Global dedup_key so trigger + resolve refer to the same incident.
    // Per-job dedup keys would create one incident per job; a single
    // umbrella incident is friendlier for on-call rotation.
    const dedupKey = "lms-cron-health";

    // Empty matching[] means we're being asked to resolve (called from
    // dispatchAlertWebhook's healthy branch). PagerDuty no-ops resolve
    // when no open incident exists, so this is safe to fire on every
    // healthy check.
    if (matching.length === 0) {
      return {
        routing_key: routingKey,
        event_action: "resolve",
        dedup_key: dedupKey,
      };
    }

    const sev = matching.some((a) => /\[critical\]/.test(a)) ? "critical" : "warning";
    return {
      routing_key: routingKey,
      event_action: "trigger",
      dedup_key: dedupKey,
      payload: {
        summary: `LMS cron health ${payload.status}: ${matching[0]}`,
        severity: sev,
        source: "lms-platform",
        component: "cron",
        custom_details: {
          checked_at: payload.checked_at,
          alerts: matching,
          all_alerts: payload.alerts,
          jobs: payload.jobs,
        },
      },
    };
  }

  // generic
  return {
    status: payload.status,
    checked_at: payload.checked_at,
    alerts: matching,
    all_alerts: payload.alerts,
    jobs: payload.jobs,
  };
}

// Allow a grace period multiplier before alerting (e.g. 2x the expected interval)
const GRACE_MULTIPLIER = 2;

// ─── Functions ───────────────────────────────────────────────────

/**
 * Logs the result of a cron job execution to the cron_runs table.
 */
export async function logCronRun(log: CronRunLog): Promise<void> {
  const service = createServiceClient();

  const { error } = await service.from("cron_runs").insert({
    job_name: log.job_name,
    status: log.status,
    duration_ms: log.duration_ms,
    records_processed: log.records_processed,
    error_message: log.error_message ?? null,
  });

  if (error) {
    // Don't throw — logging should not break the cron job itself
    console.error(`Failed to log cron run for ${log.job_name}:`, error.message);
  }
}

/**
 * Helper to wrap a cron job's main logic with timing and automatic logging.
 * Returns whatever the wrapped function returns.
 */
export async function withCronMonitoring<T extends { records_processed?: number }>(
  jobName: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration_ms = Date.now() - start;

    await logCronRun({
      job_name: jobName,
      status: "success",
      duration_ms,
      records_processed: result.records_processed ?? 0,
    });

    return result;
  } catch (err) {
    const duration_ms = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);

    await logCronRun({
      job_name: jobName,
      status: "failure",
      duration_ms,
      records_processed: 0,
      error_message: errorMessage,
    });

    throw err;
  }
}

/**
 * Checks the health of all known cron jobs by inspecting the cron_runs table.
 * Returns the latest run status for each job and any alerts for overdue or failing jobs.
 */
export async function checkCronHealth(): Promise<CronHealthReport> {
  const service = createServiceClient();
  const alerts: string[] = [];
  const jobs: CronJobHealth[] = [];

  // Get the most recent run for each known job
  const knownJobs = Object.keys(EXPECTED_INTERVALS);

  for (const jobName of knownJobs) {
    const { data: latestRun } = await service
      .from("cron_runs")
      .select("job_name, status, created_at, error_message")
      .eq("job_name", jobName)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!latestRun) {
      jobs.push({ name: jobName, last_run: "never", status: "unknown" });
      alerts.push(`${jobName}: has never run — check cron configuration`);
      continue;
    }

    jobs.push({
      name: jobName,
      last_run: latestRun.created_at,
      status: latestRun.status,
    });

    // Check if the last run failed
    if (latestRun.status === "failure") {
      alerts.push(
        `${jobName}: last run failed — ${latestRun.error_message || "no error message"}`
      );
    }

    // Check if the job is overdue. Per-job thresholds from
    // cron-thresholds.json override the default 2×/4× heuristic when
    // present. Critical takes precedence over warn in the emitted alert.
    const expectedMinutes = EXPECTED_INTERVALS[jobName];
    if (expectedMinutes) {
      const lastRunTime = new Date(latestRun.created_at).getTime();
      const elapsedMs = Date.now() - lastRunTime;
      const elapsedMin = elapsedMs / 60000;
      const overrides = JOB_THRESHOLDS[jobName] ?? {};
      const warnAt = overrides.warn_minutes ?? expectedMinutes * GRACE_MULTIPLIER;
      const criticalAt = overrides.critical_minutes ?? expectedMinutes * GRACE_MULTIPLIER * 2;

      if (elapsedMin > criticalAt) {
        alerts.push(
          `${jobName} [critical]: overdue by ~${Math.round(elapsedMin - criticalAt)} minutes past critical threshold (${Math.round(criticalAt)}min); expected every ${expectedMinutes}min`
        );
      } else if (elapsedMin > warnAt) {
        alerts.push(
          `${jobName} [warn]: overdue by ~${Math.round(elapsedMin - warnAt)} minutes past warn threshold (${Math.round(warnAt)}min); expected every ${expectedMinutes}min`
        );
      }
    }
  }

  // Also check for any recent consecutive failures across any job. The
  // window (how many recent runs to inspect) and threshold (how many in a
  // row trigger the alert) are configurable in cron-thresholds.json.
  // Default: window=5, threshold=3 — matches the legacy behavior of
  // looking at the last 3 runs.
  const cfWindow = Math.max(1, ALERT_CONFIG.consecutive_failures?.window ?? 5);
  const cfThreshold = Math.max(1, ALERT_CONFIG.consecutive_failures?.threshold ?? 3);
  for (const jobName of knownJobs) {
    const { data: recentRuns } = await service
      .from("cron_runs")
      .select("status")
      .eq("job_name", jobName)
      .order("created_at", { ascending: false })
      .limit(cfWindow);

    if (!recentRuns || recentRuns.length < cfThreshold) continue;
    // Walk the run history from newest → oldest and count the leading
    // streak of failures. If the streak reaches cfThreshold, alert.
    let streak = 0;
    for (const r of recentRuns) {
      if (r.status === "failure") streak++;
      else break;
    }
    if (streak >= cfThreshold) {
      alerts.push(
        `${jobName} [critical]: ${streak} consecutive failures (threshold ${cfThreshold}) — requires investigation`
      );
    }
  }

  // Dispatch the alert webhook (fire-and-forget) before returning.
  dispatchAlertWebhook({
    status: alerts.length > 0 ? "degraded" : "healthy",
    checked_at: new Date().toISOString(),
    jobs,
    alerts,
  }).catch(() => {});

  return { jobs, alerts };
}

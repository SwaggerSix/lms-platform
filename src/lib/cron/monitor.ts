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

/**
 * Optional per-job alert thresholds from cron-thresholds.json at the repo
 * root. Falls back to 2× expected (warn) and 4× expected (critical) when a
 * job isn't listed.
 */
function loadThresholds(): Record<string, JobThresholds> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const p = path.join(process.cwd(), "cron-thresholds.json");
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, "utf8");
    const cfg = JSON.parse(raw) as { thresholds?: Record<string, JobThresholds> };
    return cfg.thresholds ?? {};
  } catch {
    return {};
  }
}

const JOB_THRESHOLDS = loadThresholds();

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

  // Also check for any recent consecutive failures across any job
  for (const jobName of knownJobs) {
    const { data: recentRuns } = await service
      .from("cron_runs")
      .select("status")
      .eq("job_name", jobName)
      .order("created_at", { ascending: false })
      .limit(3);

    if (
      recentRuns &&
      recentRuns.length >= 3 &&
      recentRuns.every((r) => r.status === "failure")
    ) {
      alerts.push(`${jobName}: 3 consecutive failures — requires investigation`);
    }
  }

  return { jobs, alerts };
}

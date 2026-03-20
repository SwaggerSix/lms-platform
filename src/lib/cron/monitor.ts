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

const EXPECTED_INTERVALS: Record<string, number> = {
  "daily-analytics": 24 * 60, // daily
  "enrollment-rules": 60, // hourly
  "compute-recommendations": 24 * 60, // daily
  "scheduled-reports": 60, // hourly
};

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

    // Check if the job is overdue
    const expectedMinutes = EXPECTED_INTERVALS[jobName];
    if (expectedMinutes) {
      const lastRunTime = new Date(latestRun.created_at).getTime();
      const maxAllowedMs = expectedMinutes * GRACE_MULTIPLIER * 60 * 1000;
      const elapsed = Date.now() - lastRunTime;

      if (elapsed > maxAllowedMs) {
        const overdueMinutes = Math.round((elapsed - maxAllowedMs) / 60000);
        alerts.push(
          `${jobName}: overdue by ~${overdueMinutes} minutes (expected every ${expectedMinutes}min)`
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

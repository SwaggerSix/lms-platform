import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, writeFileSync, rmSync, utimesSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Live config refresh tests: a deploy or operator edit that updates
 * cron-thresholds.json should take effect on the next dispatch without
 * a process restart. The implementation reads via readThresholdsConfig's
 * mtime cache; this test mutates the file (with a future mtime to
 * guarantee invalidation) between dispatches and asserts the new
 * config wins.
 *
 * Same temp-dir + chdir + vi.resetModules pattern as
 * cron-dispatch-adapters.test.ts. cwd is restored in afterEach.
 */

const baseDegraded = {
  status: "degraded" as const,
  checked_at: "2026-03-16T12:00:00.000Z",
  jobs: [
    { name: "compliance-recurrence", last_run: "2026-03-13T04:15:00Z", status: "success" },
  ],
  alerts: [
    "compliance-recurrence [critical]: overdue by ~120 minutes",
  ],
};

function stageDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "live-config-"));
  // Stub vercel.json so the monitor's EXPECTED_INTERVALS load doesn't
  // pick up the repo's real schedules and pollute the test.
  writeFileSync(
    join(dir, "vercel.json"),
    JSON.stringify({ crons: [{ path: "/api/cron/compliance-recurrence", schedule: "0 4 * * *" }] })
  );
  return dir;
}

function writeThresholds(dir: string, cfg: Record<string, unknown>): void {
  writeFileSync(join(dir, "cron-thresholds.json"), JSON.stringify(cfg));
}

describe("dispatchAlertWebhook — live config refresh", () => {
  const originalCwd = process.cwd();
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  let dir: string | null = null;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as any;
    process.env.CRON_ALERT_WEBHOOK_URL = "https://example.com/hook";
  });

  afterEach(() => {
    process.chdir(originalCwd);
    globalThis.fetch = originalFetch;
    delete process.env.CRON_ALERT_WEBHOOK_URL;
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    dir = null;
    vi.resetModules();
  });

  it("picks up a cron-thresholds.json change between dispatches without restart", async () => {
    dir = stageDir();
    writeThresholds(dir, {
      alert_webhook: { adapter: "generic", min_severity: "critical", dry_run: false },
    });
    process.chdir(dir);
    vi.resetModules();
    const mod = await import("@/lib/cron/monitor");

    // First dispatch → adapter=generic, fetch fires.
    await mod.dispatchAlertWebhook(baseDegraded);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(firstBody).toHaveProperty("status"); // generic shape

    // Update the file with a future mtime so the mtime cache
    // definitely invalidates regardless of fs granularity. Switch to
    // dry_run so the next dispatch logs instead of POSTing.
    writeThresholds(dir, {
      alert_webhook: { adapter: "generic", min_severity: "critical", dry_run: true },
    });
    const future = (Date.now() + 5000) / 1000;
    utimesSync(join(dir, "cron-thresholds.json"), future, future);

    // Second dispatch should now see dry_run=true and NOT call fetch.
    fetchMock.mockClear();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await mod.dispatchAlertWebhook(baseDegraded);
      expect(fetchMock).not.toHaveBeenCalled();
      // The dry-run path writes a structured JSON line to console.log.
      const dryRunCalls = logSpy.mock.calls
        .map((c) => (typeof c[0] === "string" ? c[0] : ""))
        .filter((s) => s.includes('"type":"cron_alert_dry_run"'));
      expect(dryRunCalls.length).toBeGreaterThan(0);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("pagerduty_dedup change (global → per-job) takes effect immediately", async () => {
    dir = stageDir();
    process.env.PAGERDUTY_ROUTING_KEY = "rk-test";
    writeThresholds(dir, {
      alert_webhook: { adapter: "pagerduty", min_severity: "critical", pagerduty_dedup: "global" },
    });
    process.chdir(dir);
    vi.resetModules();
    const mod = await import("@/lib/cron/monitor");

    // Multi-job critical payload — global mode fires one trigger with
    // the shared dedup_key.
    const multi = {
      ...baseDegraded,
      jobs: [
        { name: "compliance-recurrence", last_run: "2026-03-13T04:15:00Z", status: "success" },
        { name: "scheduled-reports", last_run: "2026-03-16T09:00:00Z", status: "success" },
      ],
      alerts: [
        "compliance-recurrence [critical]: overdue by ~120m",
        "scheduled-reports [critical]: overdue by ~60m",
      ],
    };
    await mod.dispatchAlertWebhook(multi);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    let body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.dedup_key).toBe("lms-cron-health");

    // Switch to per-job; next dispatch fires one trigger per job.
    writeThresholds(dir, {
      alert_webhook: {
        adapter: "pagerduty",
        min_severity: "critical",
        pagerduty_dedup: "per-job",
      },
    });
    const future = (Date.now() + 5000) / 1000;
    utimesSync(join(dir, "cron-thresholds.json"), future, future);

    fetchMock.mockClear();
    await mod.dispatchAlertWebhook(multi);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const keys = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).dedup_key).sort();
    expect(keys).toEqual([
      "lms-cron-health-compliance-recurrence",
      "lms-cron-health-scheduled-reports",
    ]);

    delete process.env.PAGERDUTY_ROUTING_KEY;
  });

  it("consecutive_failures threshold change takes effect immediately", async () => {
    dir = stageDir();
    writeThresholds(dir, {
      consecutive_failures: { window: 5, threshold: 3 },
    });
    process.chdir(dir);
    vi.resetModules();
    const mod = await import("@/lib/cron/monitor");

    expect(mod.getConsecutiveFailuresConfig()).toEqual({ window: 5, threshold: 3 });

    // Bump the threshold so a 3-in-a-row streak no longer alerts.
    writeThresholds(dir, {
      consecutive_failures: { window: 10, threshold: 5 },
    });
    const future = (Date.now() + 5000) / 1000;
    utimesSync(join(dir, "cron-thresholds.json"), future, future);

    expect(mod.getConsecutiveFailuresConfig()).toEqual({ window: 10, threshold: 5 });
  });

  it("leadingFailureStreak counts the leading run only", async () => {
    dir = stageDir();
    process.chdir(dir);
    vi.resetModules();
    const mod = await import("@/lib/cron/monitor");

    // Newest first.
    expect(
      mod.leadingFailureStreak([
        { status: "failure" },
        { status: "failure" },
        { status: "failure" },
      ])
    ).toBe(3);
    expect(
      mod.leadingFailureStreak([
        { status: "success" },
        { status: "failure" },
        { status: "failure" },
      ])
    ).toBe(0);
    expect(
      mod.leadingFailureStreak([
        { status: "failure" },
        { status: "success" },
        { status: "failure" },
      ])
    ).toBe(1);
    expect(mod.leadingFailureStreak([])).toBe(0);
  });

  it("replay.dedup_minutes change takes effect immediately", async () => {
    dir = stageDir();
    writeThresholds(dir, { replay: { dedup_minutes: 5 } });
    process.chdir(dir);
    vi.resetModules();
    const { getReplayDedupMinutes } = await import("@/lib/cron/thresholds-config");

    expect(getReplayDedupMinutes()).toBe(5);

    // Set to 30 (longer window).
    writeThresholds(dir, { replay: { dedup_minutes: 30 } });
    let future = (Date.now() + 5000) / 1000;
    utimesSync(join(dir, "cron-thresholds.json"), future, future);
    expect(getReplayDedupMinutes()).toBe(30);

    // Set to 0 (explicit opt-out).
    writeThresholds(dir, { replay: { dedup_minutes: 0 } });
    future = (Date.now() + 10000) / 1000;
    utimesSync(join(dir, "cron-thresholds.json"), future, future);
    expect(getReplayDedupMinutes()).toBe(0);

    // Negative → default 5.
    writeThresholds(dir, { replay: { dedup_minutes: -7 } });
    future = (Date.now() + 15000) / 1000;
    utimesSync(join(dir, "cron-thresholds.json"), future, future);
    expect(getReplayDedupMinutes()).toBe(5);

    // Missing key → default 5.
    writeThresholds(dir, {});
    future = (Date.now() + 20000) / 1000;
    utimesSync(join(dir, "cron-thresholds.json"), future, future);
    expect(getReplayDedupMinutes()).toBe(5);
  });

  it("min_severity change takes effect immediately", async () => {
    dir = stageDir();
    // Start: critical-only filter, warn alerts are dropped.
    writeThresholds(dir, {
      alert_webhook: { adapter: "generic", min_severity: "critical" },
    });
    process.chdir(dir);
    vi.resetModules();
    const mod = await import("@/lib/cron/monitor");

    const warnOnly = {
      ...baseDegraded,
      alerts: ["scheduled-reports [warn]: overdue by ~10 minutes"],
    };
    await mod.dispatchAlertWebhook(warnOnly);
    expect(fetchMock).not.toHaveBeenCalled();

    // Switch to warn-and-up; next dispatch should fire.
    writeThresholds(dir, {
      alert_webhook: { adapter: "generic", min_severity: "warn" },
    });
    const future = (Date.now() + 5000) / 1000;
    utimesSync(join(dir, "cron-thresholds.json"), future, future);

    await mod.dispatchAlertWebhook(warnOnly);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

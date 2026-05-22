import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Adapter-specific behavior of dispatchAlertWebhook is config-driven
 * (cron-thresholds.json is read at module load). To exercise each
 * adapter path we need to:
 *   1. Stage a temporary cron-thresholds.json with the wanted adapter.
 *   2. chdir to that directory so process.cwd() lookups find the file.
 *   3. vi.resetModules() so the monitor module re-reads config on next
 *      import.
 *
 * The buildAlertBody tests cover payload shape per adapter; these tests
 * focus on whether dispatch fires (and how many times) under each
 * adapter + dedup mode.
 */

const samplePayload = {
  status: "degraded" as const,
  checked_at: "2026-03-16T12:00:00.000Z",
  jobs: [
    { name: "compliance-recurrence", last_run: "2026-03-13T04:15:00Z", status: "success" },
    { name: "scheduled-reports", last_run: "2026-03-16T09:00:00Z", status: "success" },
  ],
  alerts: [
    "compliance-recurrence [critical]: overdue by ~120 minutes past critical threshold",
    "scheduled-reports [critical]: overdue by ~60 minutes past critical threshold",
  ],
};

const healthyPayload = {
  status: "healthy" as const,
  checked_at: "2026-03-16T12:00:00.000Z",
  jobs: [
    { name: "compliance-recurrence", last_run: "2026-03-16T04:15:00Z", status: "success" },
    { name: "scheduled-reports", last_run: "2026-03-16T09:00:00Z", status: "success" },
  ],
  alerts: [] as string[],
};

function withConfig(
  cfg: Record<string, unknown>
): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "cron-thresholds-"));
  // Also create a stub vercel.json so loadIntervalsFromVercelJson finds
  // something (otherwise FALLBACK_INTERVALS is used, which is fine).
  writeFileSync(
    join(dir, "vercel.json"),
    JSON.stringify({ crons: [{ path: "/api/cron/scheduled-reports", schedule: "0 * * * *" }] })
  );
  writeFileSync(join(dir, "cron-thresholds.json"), JSON.stringify(cfg));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

async function importMonitorFromDir(dir: string) {
  // Stays chdir'd into `dir` so subsequent dispatchAlertWebhook calls
  // see the staged cron-thresholds.json via readThresholdsConfig's
  // per-call process.cwd() lookup. The afterEach hook restores the
  // original cwd.
  process.chdir(dir);
  vi.resetModules();
  return await import("@/lib/cron/monitor");
}

describe("dispatchAlertWebhook — adapter dispatch", () => {
  const originalFetch = globalThis.fetch;
  const originalCwd = process.cwd();
  let fetchMock: ReturnType<typeof vi.fn>;
  let cleanups: Array<() => void> = [];

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as any;
    process.env.CRON_ALERT_WEBHOOK_URL = "https://example.com/hook";
  });

  afterEach(() => {
    process.chdir(originalCwd);
    globalThis.fetch = originalFetch;
    delete process.env.CRON_ALERT_WEBHOOK_URL;
    delete process.env.PAGERDUTY_ROUTING_KEY;
    for (const c of cleanups) c();
    cleanups = [];
    vi.resetModules();
  });

  it("slack adapter fires one POST with Slack-shaped body", async () => {
    const { dir, cleanup } = withConfig({
      alert_webhook: { adapter: "slack", min_severity: "critical" },
    });
    cleanups.push(cleanup);
    const mod = await importMonitorFromDir(dir);
    await mod.dispatchAlertWebhook(samplePayload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toHaveProperty("text");
    expect(body).toHaveProperty("blocks");
    expect(Array.isArray(body.blocks)).toBe(true);
  });

  it("pagerduty + global dedup fires one trigger POST", async () => {
    process.env.PAGERDUTY_ROUTING_KEY = "rk-test";
    const { dir, cleanup } = withConfig({
      alert_webhook: { adapter: "pagerduty", min_severity: "critical", pagerduty_dedup: "global" },
    });
    cleanups.push(cleanup);
    const mod = await importMonitorFromDir(dir);
    await mod.dispatchAlertWebhook(samplePayload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.event_action).toBe("trigger");
    expect(body.dedup_key).toBe("lms-cron-health");
  });

  it("pagerduty + per-job dedup fires one POST per affected job", async () => {
    process.env.PAGERDUTY_ROUTING_KEY = "rk-test";
    const { dir, cleanup } = withConfig({
      alert_webhook: { adapter: "pagerduty", min_severity: "critical", pagerduty_dedup: "per-job" },
    });
    cleanups.push(cleanup);
    const mod = await importMonitorFromDir(dir);
    await mod.dispatchAlertWebhook(samplePayload);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const keys = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).dedup_key);
    expect(keys.sort()).toEqual([
      "lms-cron-health-compliance-recurrence",
      "lms-cron-health-scheduled-reports",
    ]);
  });

  it("pagerduty + global resolves one incident on healthy", async () => {
    process.env.PAGERDUTY_ROUTING_KEY = "rk-test";
    const { dir, cleanup } = withConfig({
      alert_webhook: { adapter: "pagerduty", pagerduty_dedup: "global" },
    });
    cleanups.push(cleanup);
    const mod = await importMonitorFromDir(dir);
    await mod.dispatchAlertWebhook(healthyPayload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.event_action).toBe("resolve");
    expect(body.dedup_key).toBe("lms-cron-health");
  });

  it("pagerduty + per-job resolves every known job on healthy", async () => {
    process.env.PAGERDUTY_ROUTING_KEY = "rk-test";
    const { dir, cleanup } = withConfig({
      alert_webhook: { adapter: "pagerduty", pagerduty_dedup: "per-job" },
    });
    cleanups.push(cleanup);
    const mod = await importMonitorFromDir(dir);
    await mod.dispatchAlertWebhook(healthyPayload);
    expect(fetchMock).toHaveBeenCalledTimes(healthyPayload.jobs.length);
    const keys = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).dedup_key);
    expect(keys.sort()).toEqual([
      "lms-cron-health-compliance-recurrence",
      "lms-cron-health-scheduled-reports",
    ]);
    for (const c of fetchMock.mock.calls) {
      const body = JSON.parse(c[1].body);
      expect(body.event_action).toBe("resolve");
    }
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dispatchAlertWebhook } from "@/lib/cron/monitor";

// dispatchAlertWebhook reads its adapter config from
// cron-thresholds.json at module load. We can't override that per-test
// without re-importing, so these tests target behavior driven by env
// vars + payload only (the file-loaded adapter is the default "generic"
// in the repo). The buildAlertBody tests cover the adapter-specific
// payload shapes; here we verify the side effects of dispatch.

const samplePayload = {
  status: "degraded" as const,
  checked_at: "2026-03-16T12:00:00.000Z",
  jobs: [
    { name: "compliance-recurrence", last_run: "2026-03-13T04:15:00Z", status: "success" },
  ],
  alerts: [
    "compliance-recurrence [critical]: overdue by ~120 minutes past critical threshold (4320min); expected every 1440min",
  ],
};

const healthyPayload = {
  status: "healthy" as const,
  checked_at: "2026-03-16T12:00:00.000Z",
  jobs: [
    { name: "compliance-recurrence", last_run: "2026-03-16T04:15:00Z", status: "success" },
  ],
  alerts: [] as string[],
};

describe("dispatchAlertWebhook", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as any;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.CRON_ALERT_WEBHOOK_URL;
  });

  it("no-ops when CRON_ALERT_WEBHOOK_URL is not set", async () => {
    delete process.env.CRON_ALERT_WEBHOOK_URL;
    await dispatchAlertWebhook(samplePayload);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no-ops when healthy and adapter is generic (avoids 'still fine' spam)", async () => {
    process.env.CRON_ALERT_WEBHOOK_URL = "https://example.com/hook";
    await dispatchAlertWebhook(healthyPayload);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the alert URL when degraded with critical alerts", async () => {
    process.env.CRON_ALERT_WEBHOOK_URL = "https://example.com/hook";
    await dispatchAlertWebhook(samplePayload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/hook");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      status: "degraded",
      alerts: samplePayload.alerts,
    });
  });

  it("filters by min_severity (default: critical-only)", async () => {
    process.env.CRON_ALERT_WEBHOOK_URL = "https://example.com/hook";
    // Warn-only payload — with the default min_severity=critical there
    // is no matching alert and nothing should fire.
    const warnOnly = {
      ...samplePayload,
      alerts: [
        "scheduled-reports [warn]: overdue by ~10 minutes past warn threshold (180min); expected every 60min",
      ],
    };
    await dispatchAlertWebhook(warnOnly);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows fetch errors silently (fire-and-forget contract)", async () => {
    process.env.CRON_ALERT_WEBHOOK_URL = "https://example.com/hook";
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    // Should not throw — fire-and-forget. dispatchAlertWebhook resolves
    // even when the underlying fetch rejects.
    await expect(dispatchAlertWebhook(samplePayload)).resolves.toBeUndefined();
  });

  it("does not POST when matching set is empty after severity filter", async () => {
    process.env.CRON_ALERT_WEBHOOK_URL = "https://example.com/hook";
    // No alert carries the [critical] tag → nothing matches.
    const untagged = {
      ...samplePayload,
      alerts: ["compliance-recurrence: 3 consecutive failures (no severity tag)"],
    };
    await dispatchAlertWebhook(untagged);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

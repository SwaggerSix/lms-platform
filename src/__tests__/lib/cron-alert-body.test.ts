import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildAlertBody } from "@/lib/cron/monitor";

const samplePayload = {
  status: "degraded",
  checked_at: "2026-03-16T12:00:00.000Z",
  jobs: [
    { name: "compliance-recurrence", last_run: "2026-03-13T04:15:00Z", status: "success" },
  ],
  alerts: [
    "compliance-recurrence [critical]: overdue by ~120 minutes past critical threshold (4320min); expected every 1440min",
    "scheduled-reports [warn]: overdue by ~10 minutes past warn threshold (180min); expected every 60min",
  ],
};

describe("buildAlertBody — generic adapter", () => {
  it("returns the full payload shape with matching + all_alerts + jobs", () => {
    const body = buildAlertBody("generic", samplePayload, samplePayload.alerts);
    expect(body).toMatchObject({
      status: "degraded",
      checked_at: samplePayload.checked_at,
      alerts: samplePayload.alerts,
      all_alerts: samplePayload.alerts,
    });
    expect(body!.jobs).toEqual(samplePayload.jobs);
  });
});

describe("buildAlertBody — slack adapter", () => {
  it("emits a top-level text plus mrkdwn blocks", () => {
    const body = buildAlertBody("slack", samplePayload, samplePayload.alerts);
    expect(body).not.toBeNull();
    expect(typeof body!.text).toBe("string");
    expect(body!.text).toContain("2 alerts");
    expect(Array.isArray(body!.blocks)).toBe(true);
    const blocks = body!.blocks as Array<{ type: string }>;
    expect(blocks.length).toBe(3);
    expect(blocks[0].type).toBe("section");
    expect(blocks[2].type).toBe("context");
  });

  it("uses singular 'alert' when there's only one match", () => {
    const body = buildAlertBody("slack", samplePayload, [samplePayload.alerts[0]]);
    expect((body!.text as string)).toContain("1 alert\n");
    expect((body!.text as string)).not.toContain("1 alerts");
  });

  it("escapes Slack mrkdwn metacharacters (& < >) in user-controlled content", () => {
    const dangerous = "weird-job-<script>&friends [critical]: 5 > 3";
    const body = buildAlertBody(
      "slack",
      { ...samplePayload, alerts: [dangerous] },
      [dangerous]
    );
    const text = body!.text as string;
    expect(text).not.toContain("<script>");
    expect(text).toContain("&lt;script&gt;");
    expect(text).toContain("&amp;friends");
    expect(text).toContain("5 &gt; 3");
  });
});

describe("buildAlertBody — pagerduty adapter", () => {
  beforeEach(() => {
    process.env.PAGERDUTY_ROUTING_KEY = "test-routing-key";
  });
  afterEach(() => {
    delete process.env.PAGERDUTY_ROUTING_KEY;
  });

  it("returns null when PAGERDUTY_ROUTING_KEY is missing", () => {
    delete process.env.PAGERDUTY_ROUTING_KEY;
    const body = buildAlertBody("pagerduty", samplePayload, samplePayload.alerts);
    expect(body).toBeNull();
  });

  it("emits a trigger event with stable dedup_key for non-empty matching", () => {
    const body = buildAlertBody("pagerduty", samplePayload, samplePayload.alerts);
    expect(body).toMatchObject({
      routing_key: "test-routing-key",
      event_action: "trigger",
      dedup_key: "lms-cron-health",
    });
    const pd = body as any;
    expect(pd.payload.severity).toBe("critical"); // because [critical] present
    expect(pd.payload.source).toBe("lms-platform");
    expect(pd.payload.component).toBe("cron");
    expect(pd.payload.custom_details.alerts).toEqual(samplePayload.alerts);
  });

  it("severity is 'warning' when only [warn] alerts are present", () => {
    const warnOnly = [samplePayload.alerts[1]];
    const body = buildAlertBody("pagerduty", samplePayload, warnOnly);
    expect((body as any).payload.severity).toBe("warning");
  });

  it("emits a resolve event with the same dedup_key when matching is empty", () => {
    const body = buildAlertBody(
      "pagerduty",
      { ...samplePayload, status: "healthy", alerts: [] },
      []
    );
    expect(body).toEqual({
      routing_key: "test-routing-key",
      event_action: "resolve",
      dedup_key: "lms-cron-health",
    });
  });
});

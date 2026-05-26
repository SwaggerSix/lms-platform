import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * vercel.json carries the cron schedule for every scheduled
 * endpoint. Each entry is `{ path, schedule }`. Snapshot the set
 * so a schedule bump or new cron lands as a deliberate diff —
 * "this cron now runs hourly instead of daily" should be a review
 * conversation, not a silent edit.
 */

interface VercelCron {
  path: string;
  schedule: string;
}
interface Vercel {
  crons?: VercelCron[];
}

const vercel = JSON.parse(
  readFileSync(join(process.cwd(), "vercel.json"), "utf8")
) as Vercel;

describe("vercel.json crons", () => {
  it("path → schedule map is snapshotted", () => {
    const entries = (vercel.crons ?? [])
      .map((c) => `${c.path}  ${c.schedule}`)
      .sort();
    expect(entries).toMatchInlineSnapshot(`
      [
        "/api/cron/compliance-recurrence  15 4 * * *",
        "/api/cron/compute-recommendations  0 3 * * *",
        "/api/cron/curriculum-review-alerts  0 9 * * *",
        "/api/cron/daily-analytics  0 2 * * *",
        "/api/cron/enrollment-rules  30 * * * *",
        "/api/cron/refresh-audit-view  30 4 * * *",
        "/api/cron/scheduled-reports  0 * * * *",
        "/api/cron/self-check  0 */6 * * *",
      ]
    `);
  });
});

import { describe, it, expect } from "vitest";
import { estimateIntervalMinutes } from "@/lib/cron/monitor";

describe("estimateIntervalMinutes (cron-parser backed)", () => {
  it("hourly schedules → 60", () => {
    expect(estimateIntervalMinutes("0 * * * *")).toBe(60);
    expect(estimateIntervalMinutes("30 * * * *")).toBe(60);
  });

  it("daily schedules → 1440", () => {
    expect(estimateIntervalMinutes("0 3 * * *")).toBe(24 * 60);
    expect(estimateIntervalMinutes("15 4 * * *")).toBe(24 * 60);
    expect(estimateIntervalMinutes("0 0 * * *")).toBe(24 * 60);
  });

  it("sub-hour step values", () => {
    expect(estimateIntervalMinutes("*/15 * * * *")).toBe(15);
    expect(estimateIntervalMinutes("*/5 * * * *")).toBe(5);
    expect(estimateIntervalMinutes("*/1 * * * *")).toBe(1);
  });

  it("weekly (DOW pinned) → 10080", () => {
    expect(estimateIntervalMinutes("0 0 * * 0")).toBe(7 * 24 * 60); // Sunday
    expect(estimateIntervalMinutes("0 9 * * 1")).toBe(7 * 24 * 60); // Monday 9am
  });

  it("monthly (DOM pinned, day-of-month 1)", () => {
    // First of each month — interval varies (28/30/31 days) so cron-parser
    // returns the actual next gap. Just assert it's within a month range.
    const v = estimateIntervalMinutes("0 0 1 * *");
    expect(v).toBeGreaterThanOrEqual(28 * 24 * 60);
    expect(v).toBeLessThanOrEqual(31 * 24 * 60);
  });

  it("ranges and lists (the bespoke parser couldn't do these)", () => {
    // 9am-5pm hourly: 7 runs per day, varying intervals; first gap is
    // 1h. cron-parser returns the next-next interval correctly.
    expect(estimateIntervalMinutes("0 9-17 * * *")).toBe(60);
    // Comma list: minutes 0, 15, 30, 45 → 15-minute interval
    expect(estimateIntervalMinutes("0,15,30,45 * * * *")).toBe(15);
  });

  it("malformed input → 24h fallback", () => {
    // Inputs that cron-parser throws on fall back to the 24h default.
    // (cron-parser is lenient about empty strings — treats them as
    // "every minute" — so that case isn't a fallback path.)
    expect(estimateIntervalMinutes("not a cron")).toBe(24 * 60);
    expect(estimateIntervalMinutes("0")).toBe(24 * 60);
    expect(estimateIntervalMinutes("* * * * * * *")).toBe(24 * 60);
  });
});

import { describe, it, expect } from "vitest";
import { formatAction, formatTimestamp } from "@/lib/audit-log/format";

describe("formatAction", () => {
  it("maps each legacy verb to its capitalized display form", () => {
    expect(formatAction("created")).toBe("Created");
    expect(formatAction("updated")).toBe("Updated");
    expect(formatAction("deleted")).toBe("Deleted");
    expect(formatAction("login")).toBe("Login");
    expect(formatAction("export")).toBe("Export");
  });

  it("is case-insensitive on the legacy verb", () => {
    expect(formatAction("CREATED")).toBe("Created");
    expect(formatAction("Updated")).toBe("Updated");
    expect(formatAction("LoGiN")).toBe("Login");
  });

  it("maps a dotted namespace by its head segment", () => {
    expect(formatAction("export.notification_audit_csv")).toBe("Export");
    expect(formatAction("created.something")).toBe("Created");
  });

  it("falls through to System for unknown heads", () => {
    expect(formatAction("replay.cron_alerts")).toBe("System");
    expect(formatAction("refresh.notification_audit_view")).toBe("System");
    expect(formatAction("manual_thing")).toBe("System");
  });

  it("falls through to System for empty / non-matching input", () => {
    expect(formatAction("")).toBe("System");
    expect(formatAction("garbage")).toBe("System");
    expect(formatAction(".leading.dot")).toBe("System");
  });
});

describe("formatTimestamp", () => {
  it("returns YYYY-MM-DD HH:MM:SS with zero-padded components", () => {
    // Use a UTC ISO string and compare against the local-time formatting
    // by constructing the same Date the helper does.
    const ts = "2026-03-14T05:09:07.123Z";
    const d = new Date(ts);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    expect(formatTimestamp(ts)).toBe(expected);
  });

  it("pads single-digit month/day/hour/minute/second", () => {
    // Pin to a Date that has single-digit values in local time, then
    // round-trip through formatTimestamp.
    const d = new Date(2026, 0, 5, 3, 7, 9, 0); // Jan 5 2026 03:07:09 local
    const out = formatTimestamp(d.toISOString());
    // Every component (after the year and the first dash) is exactly 2 digits.
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(out).toContain("2026-01-05");
  });

  it("returns '—' for empty or unparseable input", () => {
    expect(formatTimestamp("")).toBe("—");
    expect(formatTimestamp("not a date")).toBe("—");
  });
});

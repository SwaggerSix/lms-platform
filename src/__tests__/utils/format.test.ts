import { describe, it, expect } from "vitest";
import {
  formatDuration,
  formatDate,
  formatDateTime,
  formatPercent,
  formatScore,
  getInitials,
  slugify,
  truncate,
  formatNumber,
  formatRelativeTime,
} from "@/utils/format";

describe("formatDuration", () => {
  it("returns dash for null", () => {
    expect(formatDuration(null)).toBe("—");
  });

  it("returns dash for 0", () => {
    expect(formatDuration(0)).toBe("—");
  });

  it("formats minutes only", () => {
    expect(formatDuration(30)).toBe("30m");
    expect(formatDuration(59)).toBe("59m");
  });

  it("formats hours only when no remainder", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(150)).toBe("2h 30m");
    expect(formatDuration(61)).toBe("1h 1m");
  });
});

describe("formatDate", () => {
  it("returns dash for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("formats a valid date string", () => {
    const result = formatDate("2024-06-15T12:00:00");
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
  });
});

describe("formatDateTime", () => {
  it("returns dash for null", () => {
    expect(formatDateTime(null)).toBe("—");
  });

  it("formats a valid date-time string", () => {
    const result = formatDateTime("2024-06-15T14:30:00Z");
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
  });
});

describe("formatPercent", () => {
  it("returns 0% for null", () => {
    expect(formatPercent(null)).toBe("0%");
  });

  it("returns 0% for undefined", () => {
    expect(formatPercent(undefined as unknown as null)).toBe("0%");
  });

  it("rounds and formats percentage", () => {
    expect(formatPercent(75.6)).toBe("76%");
    expect(formatPercent(100)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(33.333)).toBe("33%");
  });
});

describe("formatScore", () => {
  it("returns dash for null", () => {
    expect(formatScore(null)).toBe("—");
  });

  it("formats score as percentage", () => {
    expect(formatScore(95)).toBe("95%");
    expect(formatScore(87.4)).toBe("87%");
  });
});

describe("getInitials", () => {
  it("returns uppercase initials", () => {
    expect(getInitials("John", "Doe")).toBe("JD");
    expect(getInitials("alice", "smith")).toBe("AS");
  });

  it("handles single character names", () => {
    expect(getInitials("A", "B")).toBe("AB");
  });
});

describe("slugify", () => {
  it("converts text to slug format", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(slugify("Hello! World@#$")).toBe("hello-world");
  });

  it("replaces multiple spaces with single dash", () => {
    expect(slugify("Hello   World")).toBe("hello-world");
  });

  it("handles underscores", () => {
    expect(slugify("hello_world")).toBe("hello-world");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("-Hello World-")).toBe("hello-world");
  });
});

describe("truncate", () => {
  it("returns text unchanged if shorter than limit", () => {
    expect(truncate("Hello", 10)).toBe("Hello");
  });

  it("returns text unchanged if equal to limit", () => {
    expect(truncate("Hello", 5)).toBe("Hello");
  });

  it("truncates and adds ellipsis", () => {
    expect(truncate("Hello World", 5)).toBe("Hello...");
  });
});

describe("formatNumber", () => {
  it("formats numbers with commas", () => {
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1000000)).toBe("1,000,000");
  });

  it("handles small numbers", () => {
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(0)).toBe("0");
  });
});

describe("formatRelativeTime", () => {
  it("returns 'Just now' for very recent dates", () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe("Just now");
  });

  it("returns minutes for recent dates", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours for same-day dates", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days for recent past dates", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoDaysAgo)).toBe("2d ago");
  });

  it("returns formatted date for older dates", () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(thirtyDaysAgo);
    // Should return a formatted date, not relative time
    expect(result).not.toMatch(/ago/);
  });
});

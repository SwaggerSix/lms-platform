import { describe, it, expect } from "vitest";
import { readRequiredFor, recertificationTier } from "@/lib/courses/required-training";

describe("readRequiredFor", () => {
  it("returns null when metadata is missing or empty", () => {
    expect(readRequiredFor(null)).toBeNull();
    expect(readRequiredFor(undefined)).toBeNull();
    expect(readRequiredFor({})).toBeNull();
    expect(readRequiredFor({ required_for: null })).toBeNull();
  });

  it("returns null when neither roles nor organization_ids are set", () => {
    expect(readRequiredFor({ required_for: { roles: [], organization_ids: [] } })).toBeNull();
  });

  it("parses roles and lowercases them, dropping unknowns", () => {
    const result = readRequiredFor({
      required_for: { roles: ["Learner", "ADMIN", "not_a_role", "  Manager "] },
    });
    expect(result).not.toBeNull();
    expect(result!.roles.sort()).toEqual(["admin", "learner", "manager"]);
    expect(result!.organization_ids).toEqual([]);
  });

  it("parses organization_ids, trimming and dropping empties", () => {
    const result = readRequiredFor({
      required_for: { organization_ids: [" org-1 ", "", "org-2"] },
    });
    expect(result).not.toBeNull();
    expect(result!.organization_ids).toEqual(["org-1", "org-2"]);
  });

  it("parses positive due_days; ignores zero / negative / non-numeric", () => {
    expect(readRequiredFor({ required_for: { roles: ["learner"], due_days: 30 } })!.due_days).toBe(30);
    expect(readRequiredFor({ required_for: { roles: ["learner"], due_days: 0 } })!.due_days).toBeUndefined();
    expect(readRequiredFor({ required_for: { roles: ["learner"], due_days: -5 } })!.due_days).toBeUndefined();
    expect(readRequiredFor({ required_for: { roles: ["learner"], due_days: "garbage" } })!.due_days).toBeUndefined();
  });

  it("parses compliance fields: regulation, frequency_months, is_mandatory", () => {
    const result = readRequiredFor({
      required_for: {
        roles: ["learner"],
        regulation: " HIPAA  ",
        frequency_months: 12,
        is_mandatory: false,
      },
    });
    expect(result!.regulation).toBe("HIPAA");
    expect(result!.frequency_months).toBe(12);
    expect(result!.is_mandatory).toBe(false);
  });

  it("defaults is_mandatory to true when omitted", () => {
    const result = readRequiredFor({ required_for: { roles: ["learner"] } });
    expect(result!.is_mandatory).toBe(true);
  });

  it("ignores empty/whitespace regulation and non-positive frequency", () => {
    const result = readRequiredFor({
      required_for: { roles: ["learner"], regulation: "   ", frequency_months: 0 },
    });
    expect(result!.regulation).toBeUndefined();
    expect(result!.frequency_months).toBeUndefined();
  });
});

describe("recertificationTier", () => {
  // Anchor "now" to a fixed moment so the assertions are deterministic.
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("returns null when frequencyMonths is 0 or negative", () => {
    expect(recertificationTier("2025-01-01T00:00:00Z", 0, now)).toBeNull();
    expect(recertificationTier("2025-01-01T00:00:00Z", -3, now)).toBeNull();
  });

  it("returns null when the completion is recent and not yet within the 30-day window", () => {
    // completed 1 month ago + 12-month recurrence → ~11 months left.
    const completed = new Date("2026-05-15T12:00:00.000Z");
    expect(recertificationTier(completed, 12, now)).toBeNull();
  });

  it("returns '30' when within 30 days of expiry", () => {
    // Completed 2025-07-05 → expires 2026-07-05 → 20 days after now (2026-06-15).
    const completed = new Date("2025-07-05T12:00:00.000Z");
    expect(recertificationTier(completed, 12, now)).toBe("30");
  });

  it("returns '7' when within 7 days of expiry", () => {
    // Completed 2025-06-20 → expires 2026-06-20 → 5 days after now.
    const completed = new Date("2025-06-20T12:00:00.000Z");
    expect(recertificationTier(completed, 12, now)).toBe("7");
  });

  it("returns 'expired' when expiry has passed", () => {
    const completed = new Date("2025-01-01T12:00:00.000Z");
    expect(recertificationTier(completed, 12, now)).toBe("expired");
  });

  it("treats expiry on the same day as 'expired' (boundary safety)", () => {
    // Completed exactly 12 months ago → expires today → daysLeft <= 0 → expired.
    const completed = new Date("2025-06-15T12:00:00.000Z");
    expect(recertificationTier(completed, 12, now)).toBe("expired");
  });

  it("handles ISO string input identically to Date input", () => {
    const completed = "2025-07-05T12:00:00.000Z";
    expect(recertificationTier(completed, 12, now)).toBe("30");
  });

  it("returns null for unparseable date input", () => {
    expect(recertificationTier("not a date", 12, now)).toBeNull();
  });

  describe("edge-of-month arithmetic (date-fns calendar-aware)", () => {
    // recertificationTier delegates to date-fns addMonths, which clamps the
    // day to the last day of the target month rather than rolling over.
    // Jan 31 + 1 month → Feb 28 (or Feb 29 in a leap year), not March 3.

    it("Jan 31 + 1 month clamps to Feb 28 (non-leap)", () => {
      const completed = new Date("2025-01-31T12:00:00.000Z");
      // Expiry = 2025-02-28. Now = 2025-02-15 → 13 days out → tier "30".
      const nowFixed = new Date("2025-02-15T12:00:00.000Z");
      expect(recertificationTier(completed, 1, nowFixed)).toBe("30");
    });

    it("Jan 31 + 1 month within 7 days of clamped expiry → tier '7'", () => {
      const completed = new Date("2025-01-31T12:00:00.000Z");
      // Expiry = 2025-02-28. Now = 2025-02-25 → 3 days out → tier "7".
      const nowFixed = new Date("2025-02-25T12:00:00.000Z");
      expect(recertificationTier(completed, 1, nowFixed)).toBe("7");
    });

    it("Jan 30 + 12 months lands on the same calendar day next year", () => {
      const completed = new Date("2024-01-30T12:00:00.000Z");
      const nowFixed = new Date("2025-01-15T12:00:00.000Z"); // 15 days before
      expect(recertificationTier(completed, 12, nowFixed)).toBe("30");
    });

    it("Feb 29 (leap) + 12 months clamps to Feb 28 next year", () => {
      // 2024 is a leap year, 2025 is not. date-fns addMonths clamps
      // 2024-02-29 + 12 months to 2025-02-28.
      const completed = new Date("2024-02-29T12:00:00.000Z");
      const nowFar = new Date("2025-02-10T12:00:00.000Z"); // 18 days out
      expect(recertificationTier(completed, 12, nowFar)).toBe("30");
      const nowNear = new Date("2025-02-25T12:00:00.000Z"); // 3 days out
      expect(recertificationTier(completed, 12, nowNear)).toBe("7");
      const nowAfter = new Date("2025-03-01T12:00:00.000Z");
      expect(recertificationTier(completed, 12, nowAfter)).toBe("expired");
    });

    it("36-month frequency: completed 35.5 months ago → tier 30", () => {
      const completed = new Date("2023-06-30T12:00:00.000Z");
      const nowFixed = new Date("2026-06-15T12:00:00.000Z"); // 15 days before 2026-06-30
      expect(recertificationTier(completed, 36, nowFixed)).toBe("30");
    });

    it("frequency expressed as non-integer is floored before addMonths", () => {
      const completed = new Date("2025-01-15T12:00:00.000Z");
      // Math.floor(12.7) → 12 months, expiry = 2026-01-15. Now 2026-01-10
      // → 5 days out → tier "7".
      const nowFixed = new Date("2026-01-10T12:00:00.000Z");
      expect(recertificationTier(completed, 12.7, nowFixed)).toBe("7");
    });
  });
});

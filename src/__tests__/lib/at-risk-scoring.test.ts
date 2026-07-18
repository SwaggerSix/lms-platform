import { describe, it, expect } from "vitest";
import {
  scoreEnrollmentRisk,
  riskLevelForScore,
} from "@/lib/analytics/predictive";

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
const daysAhead = (n: number) =>
  new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

describe("scoreEnrollmentRisk", () => {
  it("scores a fresh, recently accessed enrollment as low risk", () => {
    const { riskPoints } = scoreEnrollmentRisk({
      progress: 5,
      enrolled_at: daysAgo(2),
      due_date: daysAhead(60),
      last_accessed_at: daysAgo(1),
    });
    expect(riskPoints).toBeLessThan(25);
  });

  it("flags stalled progress after a week (25 points)", () => {
    const { riskPoints, factors } = scoreEnrollmentRisk({
      progress: 5,
      enrolled_at: daysAgo(10),
      due_date: null,
      last_accessed_at: daysAgo(1),
    });
    expect(factors.low_progress).toBe(5);
    expect(riskPoints).toBe(25);
  });

  it("flags overdue enrollments (20 points) with overdue_days factor", () => {
    const { riskPoints, factors } = scoreEnrollmentRisk({
      progress: 80,
      enrolled_at: daysAgo(5),
      due_date: daysAgo(3),
      last_accessed_at: daysAgo(1),
    });
    expect(factors.overdue_days).toBe(3);
    expect(riskPoints).toBe(20);
  });

  it("flags never-accessed enrollments (15 points)", () => {
    const { riskPoints, factors } = scoreEnrollmentRisk({
      progress: 0,
      enrolled_at: daysAgo(2),
      due_date: null,
      last_accessed_at: null,
    });
    expect(factors.never_accessed).toBe("true");
    expect(riskPoints).toBe(15);
  });

  it("stacks all three factors for a stalled, overdue, inactive learner", () => {
    const { riskPoints } = scoreEnrollmentRisk({
      progress: 5,
      enrolled_at: daysAgo(30),
      due_date: daysAgo(10),
      last_accessed_at: daysAgo(20),
    });
    // 25 (stalled) + 20 (overdue) + 20 (inactive 14+ days)
    expect(riskPoints).toBe(65);
    expect(riskLevelForScore(riskPoints)).toBe("high");
  });

  it("treats null progress as zero", () => {
    const a = scoreEnrollmentRisk({
      progress: null,
      enrolled_at: daysAgo(10),
      due_date: null,
      last_accessed_at: daysAgo(1),
    });
    const b = scoreEnrollmentRisk({
      progress: 0,
      enrolled_at: daysAgo(10),
      due_date: null,
      last_accessed_at: daysAgo(1),
    });
    expect(a.riskPoints).toBe(b.riskPoints);
  });
});

describe("riskLevelForScore", () => {
  it("maps scores to the platform's level buckets", () => {
    expect(riskLevelForScore(0)).toBe("low");
    expect(riskLevelForScore(24)).toBe("low");
    expect(riskLevelForScore(25)).toBe("medium");
    expect(riskLevelForScore(50)).toBe("high");
    expect(riskLevelForScore(75)).toBe("critical");
    expect(riskLevelForScore(100)).toBe("critical");
  });
});

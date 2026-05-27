import { describe, it, expect } from "vitest";
import { calculateMatchScore } from "@/lib/mentorship/matching";

/**
 * Unit tests for the pure mentor-match scorer. Previously untested;
 * pins the component weights (overlap 40, availability 20, capacity
 * 10, experience 15, rating 15) and the rounding / clamping.
 */

const baseMentee = {
  preferredAreas: ["leadership", "strategy"],
  goals: "grow",
  skills: ["communication"],
};
const baseMentor = {
  expertiseAreas: ["leadership", "strategy"],
  availability: "available",
  yearsExperience: 10,
  rating: 5,
  currentMenteeCount: 0,
  maxMentees: 5,
};

describe("calculateMatchScore", () => {
  it("awards a perfect score for full overlap, available, idle, senior, top-rated", () => {
    expect(calculateMatchScore(baseMentee, baseMentor)).toBe(100);
  });

  it("returns the floor for no overlap, unavailable, full capacity, junior, unrated", () => {
    const score = calculateMatchScore(
      { preferredAreas: ["finance"], goals: "", skills: [] },
      {
        expertiseAreas: ["cooking"],
        availability: "none",
        yearsExperience: 0,
        rating: null,
        currentMenteeCount: 5,
        maxMentees: 5,
      }
    );
    // Only the neutral unrated contribution (7.5) applies.
    expect(score).toBe(7.5);
  });

  it("gives unrated mentors a neutral 7.5 rather than zero", () => {
    const rated = calculateMatchScore(baseMentee, { ...baseMentor, rating: 5 });
    const unrated = calculateMatchScore(baseMentee, { ...baseMentor, rating: null });
    // Top rating contributes 15; unrated contributes 7.5 → 7.5 less.
    expect(rated - unrated).toBeCloseTo(7.5, 2);
  });

  it("scales availability: limited is half of available", () => {
    const avail = calculateMatchScore(baseMentee, { ...baseMentor, availability: "available" });
    const limited = calculateMatchScore(baseMentee, { ...baseMentor, availability: "limited" });
    expect(avail - limited).toBeCloseTo(10, 2);
  });

  it("is case-insensitive on area/skill overlap", () => {
    const score = calculateMatchScore(
      { preferredAreas: ["LEADERSHIP", "Strategy"], goals: "", skills: [] },
      baseMentor
    );
    expect(score).toBe(100);
  });

  it("never exceeds 100 even with all maxed inputs", () => {
    const score = calculateMatchScore(baseMentee, {
      ...baseMentor,
      yearsExperience: 100,
      rating: 5,
    });
    expect(score).toBeLessThanOrEqual(100);
  });

  it("rounds to two decimals", () => {
    const score = calculateMatchScore(baseMentee, { ...baseMentor, rating: 3 });
    expect(Number.isInteger(score * 100)).toBe(true);
  });
});

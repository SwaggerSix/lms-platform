import { describe, it, expect } from "vitest";
import { generateRecommendedActions } from "@/lib/analytics/predictive";

/**
 * Unit tests for the pure recommended-actions generator. Previously
 * untested; pins the factor → action mapping so a tweak to a
 * threshold or string surfaces here.
 */

describe("generateRecommendedActions", () => {
  it("returns the on-track fallback when no risk factors fire", () => {
    expect(generateRecommendedActions({})).toEqual([
      "Continue monitoring - learner is on track",
    ]);
  });

  it("flags a never-accessed learner", () => {
    const actions = generateRecommendedActions({ never_accessed: "true" });
    expect(actions).toContain(
      "Send a welcome email with course highlights to encourage first login"
    );
  });

  it("uses the > 7 day threshold for re-engagement (exclusive)", () => {
    expect(generateRecommendedActions({ days_since_last_access: 7 })).toEqual([
      "Continue monitoring - learner is on track",
    ]);
    expect(
      generateRecommendedActions({ days_since_last_access: 8 })
    ).toContain(
      "Send a re-engagement notification reminding the learner of their progress"
    );
  });

  it("treats numeric thresholds type-strictly (a string day count does not fire)", () => {
    // The guard checks `typeof === "number"`, so a stringified value
    // must NOT trigger the re-engagement action.
    expect(
      generateRecommendedActions({ days_since_last_access: "30" })
    ).toEqual(["Continue monitoring - learner is on track"]);
  });

  it("adds two actions for significantly-declining engagement", () => {
    const actions = generateRecommendedActions({
      engagement_declining: "significant",
    });
    expect(actions).toContain("Assign a mentor or peer buddy to re-engage the learner");
    expect(actions).toContain(
      "Consider offering alternative learning formats (video, interactive, etc.)"
    );
  });

  it("stacks multiple factors and omits the on-track fallback", () => {
    const actions = generateRecommendedActions({
      low_progress: 10,
      avg_assessment_score: 50,
      days_until_due: 3,
    });
    expect(actions.length).toBe(3);
    expect(actions).not.toContain("Continue monitoring - learner is on track");
  });
});

import { describe, it, expect } from "vitest";
import {
  getRecommendedInstruments,
  AVAILABLE_INSTRUMENT_CODES,
  INSTRUMENT_INFO,
  THEME_RULES,
} from "@/lib/assessments/recommended-instruments";

describe("getRecommendedInstruments", () => {
  it("recommends stress/wellness instruments for a stress-management course", () => {
    const recs = getRecommendedInstruments({
      title: "Stress Management: Minimizing Stress, Burnout, and Compassion Fatigue",
    });
    const codes = recs.map((r) => r.code);
    expect(codes).toContain("PSS-10");
    expect(codes).toContain("CBI-19");
    expect(codes.length).toBeLessThanOrEqual(4);
  });

  it("recommends the psychological-safety scale for team-safety courses", () => {
    const recs = getRecommendedInstruments({
      title: "Creating Psychological Safety in the Workplace",
    });
    expect(recs.map((r) => r.code)).toContain("TPS-7");
  });

  it("recommends the transformational-leadership scale for leadership courses", () => {
    const recs = getRecommendedInstruments({
      title: "Why Leadership & Management Matter",
      categoryName: "Leadership",
    });
    expect(recs[0].code).toBe("GTL-7");
  });

  it("matches on category name and tags when the title is generic", () => {
    const byCategory = getRecommendedInstruments({
      title: "Advanced Module 3",
      categoryName: "Emotional Intelligence",
    });
    expect(byCategory.map((r) => r.code)).toContain("TEQ-16");

    const byTags = getRecommendedInstruments({
      title: "Advanced Module 3",
      tags: ["resilience", "wellbeing"],
    });
    expect(byTags.map((r) => r.code)).toContain("BRS-6");
  });

  it("never recommends instruments that aren't imported into SurveyCraft yet", () => {
    // Conflict courses map first to CONFLICT-ADKINS/SSEIS-33/IRI-28, none of
    // which are imported — only TEQ-16 (available) should surface.
    const recs = getRecommendedInstruments({
      title: "Managing Conflict in the Workplace",
    });
    for (const rec of recs) {
      expect(AVAILABLE_INSTRUMENT_CODES.has(rec.code)).toBe(true);
    }
    expect(recs.map((r) => r.code)).toContain("TEQ-16");
    expect(recs.map((r) => r.code)).not.toContain("CONFLICT-ADKINS");
  });

  it("returns nothing for a course with no matching theme", () => {
    expect(
      getRecommendedInstruments({ title: "Forklift Certification Renewal" }),
    ).toEqual([]);
  });

  it("deduplicates codes when multiple themes match", () => {
    const recs = getRecommendedInstruments({
      title: "Leading Change with Emotional Intelligence for Leaders",
    });
    const codes = recs.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.length).toBeLessThanOrEqual(4);
  });

  it("every theme-rule code has an INSTRUMENT_INFO entry", () => {
    for (const rule of THEME_RULES) {
      for (const code of rule.codes) {
        expect(INSTRUMENT_INFO[code], `${rule.theme}: ${code}`).toBeDefined();
      }
    }
  });

  it("every available code has an INSTRUMENT_INFO entry", () => {
    for (const code of AVAILABLE_INSTRUMENT_CODES) {
      expect(INSTRUMENT_INFO[code], code).toBeDefined();
    }
  });
});

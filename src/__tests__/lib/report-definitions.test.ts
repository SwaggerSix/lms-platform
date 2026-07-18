import { describe, it, expect } from "vitest";
import {
  validateDefinitionSpec,
  REPORT_DATASETS,
} from "@/lib/reports/custom";

describe("validateDefinitionSpec", () => {
  it("accepts a valid enrollments spec", () => {
    expect(
      validateDefinitionSpec({
        dataset: "enrollments",
        columns: ["user_name", "course_title", "status"],
        filters: { status: "completed", department: "org-1" },
        sort_by: "user_name",
        sort_dir: "asc",
      })
    ).toBeNull();
  });

  it("rejects unknown datasets", () => {
    expect(
      validateDefinitionSpec({ dataset: "nope", columns: ["x"], filters: {} })
    ).toMatch(/Unknown dataset/);
  });

  it("rejects empty column lists", () => {
    expect(
      validateDefinitionSpec({ dataset: "learners", columns: [], filters: {} })
    ).toMatch(/At least one column/);
  });

  it("rejects columns not in the dataset registry", () => {
    expect(
      validateDefinitionSpec({
        dataset: "courses",
        columns: ["email"],
        filters: {},
      })
    ).toMatch(/Unknown column/);
  });

  it("rejects filters the dataset does not support", () => {
    expect(
      validateDefinitionSpec({
        dataset: "learners",
        columns: ["user_name"],
        filters: { status: "completed" },
      })
    ).toMatch(/not supported/);
  });

  it("ignores empty filter values", () => {
    expect(
      validateDefinitionSpec({
        dataset: "learners",
        columns: ["user_name"],
        filters: { status: "" },
      })
    ).toBeNull();
  });

  it("rejects invalid status values", () => {
    expect(
      validateDefinitionSpec({
        dataset: "enrollments",
        columns: ["user_name"],
        filters: { status: "active" },
      })
    ).toMatch(/Invalid status/);
  });

  it("requires sort_by to be a selected column", () => {
    expect(
      validateDefinitionSpec({
        dataset: "enrollments",
        columns: ["user_name"],
        filters: {},
        sort_by: "score",
      })
    ).toMatch(/sort_by/);
  });

  it("every dataset filter key is a real, honored key", () => {
    // Guards the registry itself: filters must be from the known set so the
    // query assembly in runReportDefinition can honor them.
    const known = new Set(["date_from", "date_to", "department", "status"]);
    for (const meta of Object.values(REPORT_DATASETS)) {
      for (const f of meta.filters) {
        expect(known.has(f)).toBe(true);
      }
    }
  });
});

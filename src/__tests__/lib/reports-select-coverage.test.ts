import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Confidence guard for the `as unknown as RowType[]` boundary casts
 * in src/lib/reports/generate.ts. Those casts assert a shape the
 * type checker can't verify against the loosely-typed query, so if
 * someone drops a column from a `.select(...)` the consuming map
 * would silently read `undefined` at runtime.
 *
 * This test pins that every column/relation the report maps consume
 * is still named in the query's select string — catching select
 * drift that the cast would otherwise hide.
 */

const SOURCE = readFileSync(
  join(process.cwd(), "src/lib/reports/generate.ts"),
  "utf8"
);

describe("reports/generate.ts select coverage", () => {
  it("completion report select names every consumed field", () => {
    // CompletionRow consumers: user(first_name,last_name,email,
    // organization(name)), course(title), status, score,
    // enrolled_at, completed_at, time_spent.
    for (const col of [
      "first_name",
      "last_name",
      "email",
      "organization",
      "course:courses(title)",
      "status",
      "score",
      "enrolled_at",
      "completed_at",
      "time_spent",
    ]) {
      expect(SOURCE, `completion select missing ${col}`).toContain(col);
    }
  });

  it("skills-gap report select names every consumed field", () => {
    // SkillsGapRow consumers: proficiency_level, source, assessed_at,
    // user(first_name,last_name,organization(name)),
    // skill(name,category).
    for (const col of [
      "proficiency_level",
      "source",
      "assessed_at",
      "skill:skills(name, category)",
    ]) {
      expect(SOURCE, `skills-gap select missing ${col}`).toContain(col);
    }
  });
});

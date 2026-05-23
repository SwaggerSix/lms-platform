import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "./_walk";

/**
 * The compliance_requirements table is being dropped by
 * supabase/migrations/20260318100041_compliance_requirements_drop.sql.
 * Every reader was flipped to source from courses.metadata.required_for
 * via getRequiredCourseSources (or the tenant-scoped wrapper), and
 * /api/compliance returns 410 Gone on every method.
 *
 * This guardrail fails if any new code reintroduces a query against
 * the dropped table — the query would throw at runtime once the
 * migration is applied, and a unit test is faster feedback than a
 * deploy.
 *
 * Documentation references ("formerly in compliance_requirements",
 * "the legacy compliance_requirements table is dropped by ...") are
 * fine; only live queries are flagged.
 */

const FORBIDDEN_QUERY_PATTERNS = [
  /\.from\(\s*["']compliance_requirements["']\s*\)/,
  /\bcompliance_requirements\s*\./,
];

describe("compliance_requirements table is no longer queried", () => {
  it("no .from('compliance_requirements') call survives in src/", () => {
    const files = walkFiles(join(process.cwd(), "src"));
    const offenders: Array<{ file: string; line: number; snippet: string }> = [];
    // The guardrail test itself naturally contains the patterns it's
    // looking for. Skip self-reference.
    const SELF = "src/__tests__/no-compliance-requirements-queries.test.ts";

    for (const file of files) {
      if (file.endsWith(SELF)) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (FORBIDDEN_QUERY_PATTERNS.some((re) => re.test(ln))) {
          offenders.push({
            file: file.replace(process.cwd() + "/", ""),
            line: i + 1,
            snippet: ln.trim().slice(0, 120),
          });
        }
      }
    }

    expect(
      offenders,
      `Offenders (the table is dropped by migration 20260318100041; read from courses.metadata.required_for via getRequiredCourseSources): ${JSON.stringify(offenders, null, 2)}`
    ).toEqual([]);
  });
});

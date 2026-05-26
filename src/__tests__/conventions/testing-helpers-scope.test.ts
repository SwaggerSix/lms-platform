import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";

/**
 * src/lib/testing/ holds test-only helpers (walk, withTempDir,
 * fixture builders). Production code must not import from here —
 * otherwise the helpers get pulled into the production bundle and
 * become harder to evolve.
 *
 * This guard walks src/ outside of __tests__/ and lib/testing/ and
 * fails on any `@/lib/testing/` or relative-path import of the
 * directory.
 */

const FORBIDDEN_RE = /from\s+["'](?:@\/lib\/testing\/|(?:\.{1,2}\/)+lib\/testing\/)[^"']+["']/;

describe("src/lib/testing/ scope", () => {
  it("no production code imports from src/lib/testing/", () => {
    const files = walkFiles(join(process.cwd(), "src"));
    const offenders: Array<{ file: string; line: number; snippet: string }> = [];

    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      // Skip test files and the testing module itself.
      if (rel.startsWith("src/__tests__/")) continue;
      if (rel.startsWith("src/lib/testing/")) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (FORBIDDEN_RE.test(lines[i])) {
          offenders.push({
            file: rel,
            line: i + 1,
            snippet: lines[i].trim().slice(0, 100),
          });
        }
      }
    }

    expect(
      offenders,
      `src/lib/testing/ is test-only — move the helper or inline it for production: ${JSON.stringify(offenders, null, 2)}`
    ).toEqual([]);
  });
});

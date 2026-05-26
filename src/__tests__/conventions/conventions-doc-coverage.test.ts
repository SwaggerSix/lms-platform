import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * docs/conventions.md lists every active guardrail by basename so
 * future contributors land on a single index. This test fails when
 * a new convention test ships under src/__tests__/conventions/
 * without an entry in the doc — keeps the index honest.
 *
 * Self-referential files (this one, plus the directory-listing /
 * wiring tests) are skipped since they don't represent code-level
 * conventions worth surfacing in the index.
 */

const DOC_PATH = join(process.cwd(), "docs/conventions.md");

// Tests that wire infrastructure (the hooks themselves, install
// path, lefthook parity, etc.) — the doc covers them under "Local
// install paths" instead of listing each separately in the table.
const INFRA_TESTS = new Set<string>([
  "check-script.test.ts",
  "check-script-runs.test.ts",
  "conventions-doc-coverage.test.ts",
  "docs-footprint.test.ts",
  "git-hooks.test.ts",
  "install-hooks.test.ts",
  "lefthook-parity.test.ts",
]);

describe("docs/conventions.md coverage", () => {
  it("references every code-level guardrail test by basename", () => {
    const dir = join(process.cwd(), "src/__tests__/conventions");
    const tests = readdirSync(dir)
      .filter((name) => name.endsWith(".test.ts") || name.endsWith(".test.tsx"))
      .filter((name) => !INFRA_TESTS.has(name));

    const doc = readFileSync(DOC_PATH, "utf8");
    const missing: string[] = [];
    for (const name of tests) {
      // The doc references guardrails by their bare name (without
      // the `.test.ts` suffix). Strip and search.
      const id = name.replace(/\.test\.tsx?$/, "");
      if (!doc.includes(id)) missing.push(name);
    }

    expect(
      missing,
      `These guardrail tests aren't referenced in docs/conventions.md. Add an entry to the table.`
    ).toEqual([]);
  });

  it("documents the wiring tests under one heading rather than per-file", () => {
    const doc = readFileSync(DOC_PATH, "utf8");
    // The doc names the wiring tests in a single grouped row; this
    // assertion pins that grouping so a future split forces a doc
    // rewrite too.
    for (const name of ["check-script", "git-hooks", "install-hooks", "lefthook-parity"]) {
      expect(doc).toContain(name);
    }
  });
});

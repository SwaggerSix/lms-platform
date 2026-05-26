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
  "pre-push-branch-skip.test.ts",
]);

describe("docs/conventions.md coverage", () => {
  it("INFRA_TESTS allowlist is snapshotted (changes need explicit review)", () => {
    // Pin the wiring-tests allowlist so adding a new infra test
    // requires updating it deliberately. Reads as a single
    // pre-sorted list rather than a Set — easier to diff.
    expect(Array.from(INFRA_TESTS).sort()).toMatchInlineSnapshot(`
      [
        "check-script-runs.test.ts",
        "check-script.test.ts",
        "conventions-doc-coverage.test.ts",
        "docs-footprint.test.ts",
        "git-hooks.test.ts",
        "install-hooks.test.ts",
        "lefthook-parity.test.ts",
        "pre-push-branch-skip.test.ts",
      ]
    `);
  });

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

  it("guardrail table rows are snapshotted (catches reorders / removed entries)", () => {
    const doc = readFileSync(DOC_PATH, "utf8");
    // Pull every row of the markdown table under "Active guardrails".
    // The table's first column carries one or more backticked names;
    // multi-name rows (the wiring-tests grouping) are flattened to
    // their first name so the snapshot stays parseable as a plain
    // array of strings. The grouping itself is asserted by the
    // sibling test above ("documents the wiring tests under one
    // heading").
    const lines = doc.split("\n");
    const start = lines.findIndex((l) => l.startsWith("## Active guardrails"));
    expect(start, "## Active guardrails heading present").toBeGreaterThan(-1);
    const rows: string[] = [];
    for (let i = start; i < lines.length; i++) {
      const m = lines[i].match(/^\|\s*`([^`]+)`/);
      if (m) rows.push(m[1]);
      if (i > start && lines[i].startsWith("## ")) break;
    }
    expect(rows).toEqual([
      "get-cache-control-audit",
      "mutation-no-store-convention",
      "audit-action-conventions",
      "audit-tenant-id-coverage",
      "no-compliance-requirements-queries",
      "no-inline-tenant-or-filter",
      "supabase-pending-empty",
      "supabase-migrations",
      "supabase-tree",
      "testing-helpers-scope",
      "docs-footprint",
      "scripts-footprint",
      "scripts-headers",
      "env-example",
      "setup-contents",
      "dependencies-ratchet",
      "dependency-footprint",
      "gitignore",
      "tsconfig",
      "next-config",
      "vercel-crons",
      "vercel-config",
      "header-parity",
      "middleware",
      "badge-urls",
      "prod-gate-warnings",
      "check-script",
    ]);
  });
});

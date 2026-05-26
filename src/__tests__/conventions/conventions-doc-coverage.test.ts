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
 *
 * @infra
 */

const DOC_PATH = join(process.cwd(), "docs/conventions.md");

// Tests that opt out of the per-row doc-table entry mark themselves
// with `// @infra` in the file header (typically near the top
// docstring). The marker convention keeps the opt-out localized to
// each file rather than enumerated in a central allowlist that
// drifts.
//
// Discovery: walk the conventions/ directory and read the first
// 40 lines of each test for the marker. Tests carrying the marker
// are excluded from the doc-coverage check.
const INFRA_MARKER = "@infra";

function isInfraTest(filename: string): boolean {
  const path = join(process.cwd(), "src/__tests__/conventions", filename);
  const head = readFileSync(path, "utf8").split("\n").slice(0, 40).join("\n");
  return head.includes(INFRA_MARKER);
}

describe("docs/conventions.md coverage", () => {
  it("infra-marked test set is snapshotted (additions/removals are explicit)", () => {
    // Walk and collect every test that opts out via the `@infra`
    // marker. Not redundant with conventions-directory-listing:
    // that snapshot tracks the universe of convention tests; this
    // one tracks the opt-out subset. A misplaced marker (e.g.
    // `@infra` on a code-level guardrail) surfaces here as the
    // test moving across the boundary.
    const dir = join(process.cwd(), "src/__tests__/conventions");
    const marked = readdirSync(dir)
      .filter((n) => n.endsWith(".test.ts") || n.endsWith(".test.tsx"))
      .filter(isInfraTest)
      .sort();
    expect(marked).toMatchInlineSnapshot(`
      [
        "check-script-runs.test.ts",
        "check-script.test.ts",
        "conventions-doc-coverage.test.ts",
        "docs-footprint.test.ts",
        "git-hooks.test.ts",
        "install-hooks.test.ts",
        "lefthook-parity.test.ts",
        "pre-push-branch-skip.test.ts",
        "safe-bypass.test.ts",
      ]
    `);
  });

  it("references every code-level guardrail test by basename", () => {
    const dir = join(process.cwd(), "src/__tests__/conventions");
    const tests = readdirSync(dir)
      .filter((name) => name.endsWith(".test.ts") || name.endsWith(".test.tsx"))
      .filter((name) => !isInfraTest(name));

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
      "eslint-config",
      "vercel-crons",
      "vercel-config",
      "header-parity",
      "middleware",
      "isadmin-adoption-ratchet",
      "super-admin-omission-audit",
      "admin-array-form-audit",
      "manager-equality-omission-audit",
      "admin-equality-omission-audit",
      "as-any-audit",
      "suppression-directives-audit",
      "badge-urls",
      "workflows",
      "prod-gate-warnings",
      "check-script",
    ]);
  });
});

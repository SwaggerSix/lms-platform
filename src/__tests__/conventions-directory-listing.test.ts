import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Snapshot the convention test files present in
 * src/__tests__/conventions/. Adding or removing a convention test
 * forces a snapshot update — makes the addition visible in the PR
 * diff. The `test:conventions` glob auto-picks up new files, so the
 * snapshot also serves as a paper trail of what landed when.
 *
 * This test deliberately lives outside `conventions/` so it doesn't
 * have to self-include in its own snapshot.
 */

describe("conventions directory", () => {
  it("lists every convention test", () => {
    const dir = join(process.cwd(), "src/__tests__/conventions");
    const files = readdirSync(dir)
      .filter((n) => n.endsWith(".test.ts") || n.endsWith(".test.tsx"))
      .sort();
    expect(files).toMatchInlineSnapshot(`
      [
        "audit-action-conventions.test.ts",
        "audit-tenant-id-coverage.test.ts",
        "check-script-runs.test.ts",
        "check-script.test.ts",
        "conventions-doc-coverage.test.ts",
        "dependencies-ratchet.test.ts",
        "dependency-footprint.test.ts",
        "docs-footprint.test.ts",
        "get-cache-control-audit.test.ts",
        "git-hooks.test.ts",
        "install-hooks.test.ts",
        "lefthook-parity.test.ts",
        "mutation-no-store-convention.test.ts",
        "no-compliance-requirements-queries.test.ts",
        "no-inline-tenant-or-filter.test.ts",
        "prod-gate-warnings.test.ts",
        "supabase-migrations.test.ts",
        "supabase-pending-empty.test.ts",
        "testing-helpers-scope.test.ts",
      ]
    `);
  });
});

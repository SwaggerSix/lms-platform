import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";

/**
 * Some dev-time warnings under src/lib/ are intentionally gated
 * behind `process.env.NODE_ENV !== "production"` so prod logs don't
 * flood when a regression hits the warn path at scale (see
 * logAudit's convention warning + malformed-tenantId warning).
 *
 * Most console.warn / console.error calls in src/lib/ are NOT
 * gated — they're intentional prod observability (cron failures,
 * email send errors, integration stubs, etc.).
 *
 * Snapshotting the *gated* set surfaces both directions of change:
 *   - Adding a new gate (someone's diagnostic that shouldn't reach
 *     prod logs) shows up in the diff.
 *   - Removing a gate (intentional or accidental) shows up too.
 *
 * The convention itself lives in logAudit's docstring; this test
 * makes the live set of gated call sites visible.
 */

const ROOT = join(process.cwd(), "src/lib");

interface Site {
  file: string;
  text: string;
}

function findGatedConsoleCalls(file: string): Site[] {
  const source = readFileSync(file, "utf8");
  const sites: Site[] = [];
  const RE = /console\.(warn|error)\(/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(source))) {
    // Look back ~800 chars for the prod gate expression.
    const before = source.slice(Math.max(0, m.index - 800), m.index);
    if (/process\.env\.NODE_ENV\s*!==?\s*["']production["']/.test(before)) {
      sites.push({
        file: file.replace(process.cwd() + "/", ""),
        text: source.slice(m.index, m.index + 40).replace(/\s+/g, " "),
      });
    }
  }
  return sites;
}

describe("prod-gated console warnings", () => {
  it("snapshot of every console.warn/error gated behind NODE_ENV !== 'production'", () => {
    const sites = walkFiles(ROOT).flatMap(findGatedConsoleCalls);
    const flattened = sites.map((s) => s.file).sort();
    // Collapse to file-level entries so line-number churn doesn't
    // trigger this snapshot. Same approach as audit-tenant-id-coverage.
    expect(flattened).toMatchInlineSnapshot(`
      [
        "src/lib/audit.ts",
        "src/lib/audit.ts",
        "src/lib/audit.ts",
        "src/lib/audit.ts",
      ]
    `);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";

/**
 * The audit/log tables (audit_logs, workflow_step_logs,
 * enrollment_rule_logs, …) all use the same "scope to tenant_id AND
 * include platform-level NULL rows" filter:
 *
 *     tenant_id.eq.<uuid>,tenant_id.is.null
 *
 * Single source of truth is buildAuditLogTenantFilter() in
 * src/lib/audit-log/build-query-filter.ts. Any new inline copy of
 * the literal is a divergence waiting to happen — a future change
 * (e.g. dropping the platform-NULL inclusion, switching to a stored
 * function) would silently miss the inline sites.
 *
 * This guardrail fails if anything outside the helper writes that
 * filter shape directly. The helper itself is whitelisted.
 */

const FORBIDDEN_RE = /tenant_id\.eq\.[^,]+,tenant_id\.is\.null/;

const ALLOWED = new Set<string>([
  "src/lib/audit-log/build-query-filter.ts",
  "src/__tests__/no-inline-tenant-or-filter.test.ts",
]);

describe("no inline tenant_id .or() filter literals", () => {
  it("only build-query-filter.ts contains the raw filter shape", () => {
    const files = walkFiles(join(process.cwd(), "src"));
    const offenders: Array<{ file: string; line: number; snippet: string }> = [];

    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      if (ALLOWED.has(rel)) continue;
      // Tests legitimately use the literal as the expected wire-level
      // output of buildAuditLogTenantFilter. The guardrail targets
      // production code paths, not the assertions that pin them.
      if (rel.startsWith("src/__tests__/")) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (FORBIDDEN_RE.test(lines[i])) {
          offenders.push({
            file: rel,
            line: i + 1,
            snippet: lines[i].trim().slice(0, 120),
          });
        }
      }
    }

    expect(
      offenders,
      `Use buildAuditLogTenantFilter(tenantId) from src/lib/audit-log/build-query-filter.ts instead of inlining the literal: ${JSON.stringify(offenders, null, 2)}`
    ).toEqual([]);
  });
});

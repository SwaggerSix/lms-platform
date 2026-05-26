import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";

/**
 * Advisory audit: every logAudit({...}) call site in src/app/api/
 * should explicitly opt into either passing `tenantId:` or relying on
 * the audit_logs_set_tenant_id DB trigger. Per the convention spelled
 * out on logAudit() itself:
 *
 *   - Pass tenantId for super_admin cross-tenant operations and
 *     service-role inserts (where the actor → org fallback would
 *     attribute to the wrong tenant or to NULL).
 *   - Omit tenantId for in-tenant admin actions where the actor and
 *     the entity share a tenant; the DB trigger handles it.
 *
 * This test snapshots the live set of call sites that pass tenantId
 * and the set that omits it. New call sites are flagged to choose —
 * either commit to the omission (in-tenant action) or pass tenantId.
 *
 * Snapshot maintenance: line numbers used to live in these snapshots
 * and churned on every unrelated edit. Now we collapse to file-level
 * entries with a count when a file holds more than one call (e.g.
 * "users/[id]/route.ts ×2"), so the diff surfaces only when a file
 * crosses sides or a new call lands. Refreshing with `vitest -u`
 * stays routine.
 *
 * Implementation note: the scanner matches the `tenantId:` token
 * literally inside the logAudit() argument object. Multi-line
 * argument objects are handled by walking matching braces.
 */

interface CallSite {
  file: string;
  line: number;
  hasTenantId: boolean;
}

function findLogAuditCalls(source: string, file: string): CallSite[] {
  const calls: CallSite[] = [];
  const RE = /logAudit\s*\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(source))) {
    const objStart = m.index + m[0].length - 1; // position of opening `{`
    // Walk matching braces.
    let depth = 0;
    let i = objStart;
    let end = -1;
    while (i < source.length) {
      const c = source[i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) { end = i; break; }
      }
      i++;
    }
    if (end === -1) continue;
    const body = source.slice(objStart, end + 1);
    const line = source.slice(0, objStart).split("\n").length;
    calls.push({
      file,
      line,
      hasTenantId: /\btenantId\s*:/.test(body),
    });
  }
  return calls;
}

describe("logAudit tenantId coverage (advisory)", () => {
  it("inline-snapshot of logAudit call sites that pass tenantId explicitly", () => {
    const files = walkFiles(join(process.cwd(), "src/app/api"));
    const sites: CallSite[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!/logAudit\s*\(/.test(source)) continue;
      const rel = file.replace(process.cwd() + "/", "");
      sites.push(...findLogAuditCalls(source, rel));
    }
    const withTenantId = collapseByFile(sites.filter((s) => s.hasTenantId));

    // Snapshot tracks the call sites that explicitly attribute to the
    // entity's tenant (cross-tenant / service-role inserts).
    expect(withTenantId).toMatchInlineSnapshot(`
      [
        "src/app/api/automation/rules/[id]/route.ts",
        "src/app/api/enrollments/route.ts ×2",
        "src/app/api/paths/enroll/route.ts",
        "src/app/api/users/[id]/route.ts ×2",
        "src/app/api/users/route.ts",
        "src/app/api/workflows/[id]/run/route.ts",
      ]
    `);
  });

  it("inline-snapshot of logAudit sites that rely on the DB trigger (no explicit tenantId)", () => {
    const files = walkFiles(join(process.cwd(), "src/app/api"));
    const sites: CallSite[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!/logAudit\s*\(/.test(source)) continue;
      const rel = file.replace(process.cwd() + "/", "");
      sites.push(...findLogAuditCalls(source, rel));
    }
    const withoutTenantId = collapseByFile(sites.filter((s) => !s.hasTenantId));

    // The "trigger fills tenant_id" set. Anything new landing here
    // forces a triage commit: either confirm it's in-tenant (and
    // update the snapshot in the same PR), or pass tenantId.
    expect(withoutTenantId).toMatchInlineSnapshot(`
      [
        "src/app/api/admin/cron-alert-replay/route.ts",
        "src/app/api/admin/notification-audit/refresh-view/route.ts",
        "src/app/api/admin/notification-audit/route.ts",
        "src/app/api/automation/rules/route.ts ×3",
        "src/app/api/courses/route.ts ×3",
        "src/app/api/profile/route.ts",
        "src/app/api/settings/route.ts",
        "src/app/api/users/bulk/route.ts",
        "src/app/api/workflows/[id]/route.ts ×2",
        "src/app/api/workflows/route.ts",
      ]
    `);
  });
});

/**
 * Collapse `CallSite[]` to a sorted, dedup-by-file list. Files with
 * more than one matching call get a `" ×N"` suffix so the snapshot
 * still surfaces multi-site fanout without exposing line numbers.
 */
function collapseByFile(sites: CallSite[]): string[] {
  const counts = new Map<string, number>();
  for (const s of sites) counts.set(s.file, (counts.get(s.file) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([file, n]) => (n === 1 ? file : `${file} ×${n}`))
    .sort();
}

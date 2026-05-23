import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "./_walk";

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
    const withTenantId = sites
      .filter((s) => s.hasTenantId)
      .map((s) => `${s.file}:${s.line}`)
      .sort();

    // Snapshot tracks the call sites that explicitly attribute to the
    // entity's tenant (cross-tenant / service-role inserts).
    expect(withTenantId).toMatchInlineSnapshot(`
      [
        "src/app/api/automation/rules/[id]/route.ts:115",
        "src/app/api/enrollments/route.ts:307",
        "src/app/api/enrollments/route.ts:372",
        "src/app/api/paths/enroll/route.ts:126",
        "src/app/api/users/[id]/route.ts:124",
        "src/app/api/users/[id]/route.ts:45",
        "src/app/api/users/route.ts:135",
        "src/app/api/workflows/[id]/run/route.ts:58",
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
    const withoutTenantId = sites
      .filter((s) => !s.hasTenantId)
      .map((s) => `${s.file}:${s.line}`)
      .sort();

    // The "trigger fills tenant_id" set. Anything new landing here
    // forces a triage commit: either confirm it's in-tenant (and
    // update the snapshot in the same PR), or pass tenantId.
    expect(withoutTenantId).toMatchInlineSnapshot(`
      [
        "src/app/api/admin/cron-alert-replay/route.ts:196",
        "src/app/api/admin/notification-audit/refresh-view/route.ts:45",
        "src/app/api/admin/notification-audit/route.ts:123",
        "src/app/api/automation/rules/route.ts:103",
        "src/app/api/automation/rules/route.ts:154",
        "src/app/api/automation/rules/route.ts:188",
        "src/app/api/courses/route.ts:151",
        "src/app/api/courses/route.ts:243",
        "src/app/api/courses/route.ts:291",
        "src/app/api/profile/route.ts:116",
        "src/app/api/settings/route.ts:78",
        "src/app/api/users/bulk/route.ts:211",
        "src/app/api/workflows/[id]/route.ts:103",
        "src/app/api/workflows/[id]/route.ts:75",
        "src/app/api/workflows/route.ts:79",
      ]
    `);
  });
});

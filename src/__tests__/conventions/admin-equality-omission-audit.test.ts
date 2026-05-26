import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";
import { ADMIN_EQUALITY_OMISSION_RE } from "@/lib/auth/role-check-patterns";

/**
 * Advisory ratchet: bare single-role `.role === "admin"` /
 * `.role !== "admin"` gates usually omit super_admin, who should
 * pass any admin gate. Unlike the array/equality manager forms,
 * this one is NOT always a bug — a handful of sites differentiate
 * admin from super_admin on purpose (tenant-scope resolution
 * returns a global scope for super_admin and the org id for admin).
 * So migration is a per-site review conversation, and this lands
 * as a shrinking ratchet (snapshot + ceiling) rather than a hard
 * assertion.
 *
 * Lines that also mention `super_admin` or `manager` are skipped —
 * those belong to the inequality / manager-equality audits, which
 * own those shapes. `src/lib/audit-log/resolve-tenant.ts` is
 * whitelisted: it handles super_admin on the line above (returns a
 * global scope), so its `role === "admin"` is intentional.
 *
 * Each PR that migrates a site to `isAdmin(role)` lowers MAX by the
 * number it removed. When MAX hits 0, flip to `toEqual([])`.
 */

const WHITELIST = new Set([
  "src/lib/auth/roles.ts",
  "src/lib/auth/role-check-patterns.ts",
  // super_admin handled on the preceding line (global scope);
  // the admin branch is a deliberate distinct case, not a lockout.
  "src/lib/audit-log/resolve-tenant.ts",
]);

describe("admin equality omission audit (advisory)", () => {
  it("snapshot of bare single-role admin gates omitting super_admin", () => {
    const files = walkFiles(join(process.cwd(), "src"), {
      extensions: [".ts", ".tsx"],
    });
    const sites: Array<{ file: string; line: number }> = [];
    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      if (rel.startsWith("src/__tests__/")) continue;
      if (WHITELIST.has(rel)) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("super_admin") || line.includes("manager")) continue;
        if (ADMIN_EQUALITY_OMISSION_RE.test(line)) sites.push({ file: rel, line: i + 1 });
      }
    }

    const MAX = 11;
    expect(
      sites.length,
      `bare admin-gate sites: ${sites.length}. Ceiling ${MAX}. Migrate touched sites to isAdmin() (where super_admin should pass) and lower MAX.`
    ).toBeLessThanOrEqual(MAX);

    const counts = new Map<string, number>();
    for (const s of sites) counts.set(s.file, (counts.get(s.file) ?? 0) + 1);
    const collapsed = Array.from(counts.entries())
      .map(([file, n]) => (n === 1 ? file : `${file} ×${n}`))
      .sort();
    expect(collapsed).toMatchInlineSnapshot(`
      [
        "src/app/(dashboard)/learn/mentorship/[requestId]/page.tsx",
        "src/app/api/analytics/alerts/route.ts",
        "src/app/api/assessments/[id]/route.ts",
        "src/app/api/assessments/route.ts",
        "src/app/api/enrollments/route.ts",
        "src/app/api/feedback/responses/route.ts",
        "src/app/api/mentorship/requests/[id]/route.ts ×2",
        "src/app/api/mentorship/sessions/[id]/route.ts",
        "src/app/api/mentorship/sessions/route.ts",
        "src/app/api/xapi/statements/route.ts",
      ]
    `);
  });
});

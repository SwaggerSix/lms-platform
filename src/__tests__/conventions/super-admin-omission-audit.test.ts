import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";
import { ADMIN_MANAGER_INCLUDES_RE } from "@/lib/auth/role-check-patterns";

/**
 * Latent bug surface: any `["admin", "manager"].includes(...)` /
 * `["admin", "manager", ...].includes(...)` style array-includes
 * check that omits `super_admin` is almost certainly wrong —
 * super_admin should pass any admin-or-manager gate. The
 * src/lib/auth/roles.ts docstring calls this out.
 *
 * This guardrail snapshots the live offender set. PR review sees
 * the list; migration to `isManagerOrAbove(role)` (which includes
 * super_admin) is a deliberate per-site code-review conversation,
 * not a global rewrite. Once the set is empty, flip the assertion
 * to `toEqual([])` and retire the snapshot.
 */


describe("super_admin omission audit (advisory)", () => {
  it("snapshot of array-includes role checks missing super_admin", () => {
    const files = walkFiles(join(process.cwd(), "src"));
    const sites: Array<{ file: string; line: number }> = [];
    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      if (rel.startsWith("src/__tests__/")) continue;
      if (rel === "src/lib/auth/roles.ts") continue;
      if (rel === "src/lib/auth/role-check-patterns.ts") continue;
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (ADMIN_MANAGER_INCLUDES_RE.test(lines[i])) sites.push({ file: rel, line: i + 1 });
      }
    }

    // Ratchet: site count is monotonically decreasing. Each PR
    // that migrates a site to isManagerOrAbove() lowers MAX by
    // the number it removed. When MAX hits 0, flip the snapshot
    // to `toEqual([])` and retire the ratchet.
    const MAX = 10;
    expect(
      sites.length,
      `["admin", "manager"].includes(role) sites: ${sites.length}. Ceiling ${MAX}. Migrate touched sites to isManagerOrAbove() and lower MAX.`
    ).toBeLessThanOrEqual(MAX);

    // Collapse to file-level with ×N suffix when multiple sites
    // share a file. Mirrors audit-tenant-id-coverage's approach.
    const counts = new Map<string, number>();
    for (const s of sites) counts.set(s.file, (counts.get(s.file) ?? 0) + 1);
    const collapsed = Array.from(counts.entries())
      .map(([file, n]) => (n === 1 ? file : `${file} ×${n}`))
      .sort();
    expect(collapsed).toMatchInlineSnapshot(`
      [
        "src/app/(dashboard)/admin/analytics/predictive/page.tsx",
        "src/app/(dashboard)/admin/feedback/[id]/page.tsx",
        "src/app/(dashboard)/admin/feedback/page.tsx",
        "src/app/(dashboard)/admin/mentorship/page.tsx",
        "src/app/(dashboard)/admin/reports/page.tsx",
        "src/app/api/certificates/generate/route.ts",
        "src/app/api/enrollments/route.ts ×4",
      ]
    `);
  });
});

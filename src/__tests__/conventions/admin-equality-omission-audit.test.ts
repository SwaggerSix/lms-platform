import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";
import { ADMIN_EQUALITY_OMISSION_RE } from "@/lib/auth/role-check-patterns";

/**
 * Bare single-role `.role === "admin"` / `.role !== "admin"` gates
 * usually omit super_admin, who should pass any admin gate. This
 * started as an advisory ratchet (some sites differentiate admin
 * from super_admin on purpose); the backlog hit zero on 2026-05-29,
 * so it's now a hard `toEqual([])`.
 *
 * Lines that also mention `super_admin` or `manager` are skipped —
 * those belong to the inequality / manager-equality audits, which
 * own those shapes. `src/lib/audit-log/resolve-tenant.ts` stays
 * whitelisted: it handles super_admin on the line above (returns a
 * global scope), so its `role === "admin"` branch is a deliberate
 * distinct case, not a lockout.
 */

const WHITELIST = new Set([
  "src/lib/auth/roles.ts",
  "src/lib/auth/role-check-patterns.ts",
  "src/lib/audit-log/resolve-tenant.ts",
]);

describe("admin equality omission audit", () => {
  it("no bare single-role admin gates omitting super_admin remain under src/", () => {
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

    expect(
      sites,
      `bare admin gates omit super_admin — use isAdmin(): ${JSON.stringify(sites, null, 2)}`
    ).toEqual([]);
  });
});

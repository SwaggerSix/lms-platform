import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";
import { ADMIN_SUPER_ADMIN_INCLUDES_RE } from "@/lib/auth/role-check-patterns";

/**
 * Convention: an admin gate uses `isAdmin(role)` from
 * `@/lib/auth/roles` rather than the non-canonical array form
 * `["admin", "super_admin"].includes(role)`. The array form isn't
 * buggy (super_admin is included), just non-canonical and harder
 * to grep for than the helper.
 *
 * The single offender (`/admin/evaluations`) migrated on
 * 2026-05-29, so this lands as a hard `toEqual([])` from the
 * start — no ratchet needed for a one-site backlog.
 */

describe("admin array-form audit", () => {
  it("no [\"admin\", \"super_admin\"].includes(role) sites remain under src/", () => {
    const files = walkFiles(join(process.cwd(), "src"));
    const sites: Array<{ file: string; line: number }> = [];
    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      if (rel.startsWith("src/__tests__/")) continue;
      if (rel === "src/lib/auth/roles.ts") continue;
      if (rel === "src/lib/auth/role-check-patterns.ts") continue;
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (ADMIN_SUPER_ADMIN_INCLUDES_RE.test(lines[i])) sites.push({ file: rel, line: i + 1 });
      }
    }

    expect(
      sites,
      `["admin", "super_admin"].includes(role) sites should use isAdmin(): ${JSON.stringify(sites, null, 2)}`
    ).toEqual([]);
  });
});

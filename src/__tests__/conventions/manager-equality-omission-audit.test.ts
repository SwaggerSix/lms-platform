import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";
import { MANAGER_EQUALITY_OMISSION_RE } from "@/lib/auth/role-check-patterns";

/**
 * Convention: a manager-or-above gate uses `isManagerOrAbove(role)`
 * from `@/lib/auth/roles` rather than the equality form
 * `role === "admin" || role === "manager"` (or the negated
 * `role !== "admin" && role !== "manager"`). Both omit super_admin
 * — the same latent permissions bug the array-includes form had —
 * so super_admin would silently fail a gate it should pass.
 *
 * The 7 offenders migrated on 2026-05-29, so this lands as a hard
 * `toEqual([])` to lock the shape out.
 */

describe("manager equality omission audit", () => {
  it("no equality-form manager-or-above gates omitting super_admin remain under src/", () => {
    const files = walkFiles(join(process.cwd(), "src"), {
      extensions: [".ts", ".tsx"],
    });
    const sites: Array<{ file: string; line: number }> = [];
    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      if (rel.startsWith("src/__tests__/")) continue;
      if (rel === "src/lib/auth/roles.ts") continue;
      if (rel === "src/lib/auth/role-check-patterns.ts") continue;
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (MANAGER_EQUALITY_OMISSION_RE.test(lines[i])) sites.push({ file: rel, line: i + 1 });
      }
    }

    expect(
      sites,
      `equality-form manager-or-above gates omit super_admin — use isManagerOrAbove(): ${JSON.stringify(sites, null, 2)}`
    ).toEqual([]);
  });
});

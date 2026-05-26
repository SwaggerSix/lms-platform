import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";
import { INEQUALITY_ROLE_RE } from "@/lib/auth/role-check-patterns";

/**
 * Convention: every two-role admin gate uses `isAdmin(role)` from
 * `@/lib/auth/roles` rather than the
 * `role !== "admin" && role !== "super_admin"` inequality form.
 *
 * This was originally a shrinking-ratchet (capped at N, decreased
 * with each migration). Backlog hit zero on 2026-05-29, so the
 * test now hard-fails on any reintroduction.
 *
 * Keep the file naming around `-adoption-ratchet` for historical
 * grep; the ratchet language stays in the doc since the pattern
 * is reusable for future conventions.
 */

describe("isAdmin adoption", () => {
  it("no inequality-form role checks remain under src/", () => {
    const files = walkFiles(join(process.cwd(), "src"), {
      extensions: [".ts", ".tsx"],
    });
    const matches: Array<{ file: string; line: number }> = [];
    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      if (rel.startsWith("src/__tests__/")) continue;
      if (rel === "src/lib/auth/roles.ts") continue;
      if (rel === "src/lib/auth/role-check-patterns.ts") continue;
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (INEQUALITY_ROLE_RE.test(lines[i])) {
          matches.push({ file: rel, line: i + 1 });
        }
      }
    }

    expect(
      matches,
      `Inequality-form role checks should use isAdmin() instead: ${JSON.stringify(matches, null, 2)}`
    ).toEqual([]);
  });
});

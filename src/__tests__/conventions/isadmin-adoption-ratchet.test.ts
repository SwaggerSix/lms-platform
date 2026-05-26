import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";

/**
 * Adoption ratchet for the isAdmin() helper. Counts the
 * remaining `role !== "admin" && (...)role !== "super_admin"`
 * inequality-form sites under src/. The number can only go down
 * — every PR that adds or modifies a page is invited to migrate
 * touched call sites to `!isAdmin(role)`.
 *
 * Forces incremental progress without requiring a single-PR mass
 * rewrite. Once the count hits zero, this test can flip to a hard
 * `expect(matches).toEqual([])` like the GET cache-control ratchet
 * did.
 */

const INEQUALITY_RE =
  /role\s*!==\s*"admin"\s*&&\s*[A-Za-z_.\s]*role\s*!==\s*"super_admin"/;

describe("isAdmin adoption ratchet", () => {
  it("inequality-form role checks only go down (current ceiling: 14)", () => {
    const files = walkFiles(join(process.cwd(), "src"), {
      extensions: [".ts", ".tsx"],
    });
    const matches: Array<{ file: string; line: number }> = [];
    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      if (rel.startsWith("src/__tests__/")) continue;
      if (rel === "src/lib/auth/roles.ts") continue; // the helper itself defines the role names
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (INEQUALITY_RE.test(lines[i])) {
          matches.push({ file: rel, line: i + 1 });
        }
      }
    }

    // Ratchet ceiling. Lower when migrations land; once it's 0,
    // flip the assertion to `toEqual([])`.
    const MAX = 14;
    expect(
      matches.length,
      `Inequality-form role checks: ${matches.length}. Ceiling is ${MAX}. ` +
        `Migrate touched sites to isAdmin() / isManagerOrAbove() and lower MAX.\n` +
        JSON.stringify(matches, null, 2)
    ).toBeLessThanOrEqual(MAX);
  });
});

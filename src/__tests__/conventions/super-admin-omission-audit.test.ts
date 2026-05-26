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
 * This guardrail snapshotted the live offender set while the
 * migration was in flight. The backlog hit zero on 2026-05-29, so
 * the ratchet flipped to a hard `toEqual([])` assertion: any
 * reintroduced `["admin", "manager"].includes(role)` site now
 * hard-fails. Migrate to `isManagerOrAbove(role)` (which includes
 * super_admin) instead.
 */


describe("super_admin omission audit", () => {
  it("no array-includes role checks omitting super_admin remain under src/", () => {
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

    expect(
      sites,
      `["admin", "manager"].includes(role) sites omit super_admin — use isManagerOrAbove(): ${JSON.stringify(sites, null, 2)}`
    ).toEqual([]);
  });
});

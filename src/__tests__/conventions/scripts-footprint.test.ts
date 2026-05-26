import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Catches script sprawl. scripts/ collects one-off shell + node
 * helpers (seed data, ad-hoc migrations) and tends to grow without
 * review — most additions are someone's afternoon utility that
 * later becomes load-bearing without anyone noticing. Snapshotting
 * the filename set surfaces additions during PR review.
 *
 * Allowlist intentionally empty: nothing here is "ignore me".
 */

describe("scripts footprint", () => {
  it("scripts/ directory contents are snapshotted", () => {
    const dir = join(process.cwd(), "scripts");
    const files = readdirSync(dir)
      .filter((n) => statSync(join(dir, n)).isFile())
      .sort();
    expect(files).toMatchInlineSnapshot(`
      [
        "README.md",
        "seed-data.mjs",
        "seed-database-fix.mjs",
        "seed-database.mjs",
        "seed-portal-data.mjs",
        "seed-users.sh",
      ]
    `);
  });
});

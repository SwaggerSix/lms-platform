import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Snapshot the top-level supabase/ directory entries. migrations/
 * has its own per-file snapshot (supabase-migrations); this guard
 * catches new sibling directories or files — a stray
 * `supabase/functions/`, `supabase/seed.sql`, or rogue
 * `migrations.backup.sql` lands as a diff.
 *
 * pending/ is intentionally tracked but its emptiness is asserted
 * by supabase-pending-empty.test.ts.
 */

describe("supabase/ tree", () => {
  it("top-level entries are snapshotted", () => {
    const dir = join(process.cwd(), "supabase");
    const entries = readdirSync(dir)
      .filter((name) => !name.startsWith("."))
      .map((name) => {
        const s = statSync(join(dir, name));
        return s.isDirectory() ? `${name}/` : name;
      })
      .sort();
    expect(entries).toMatchInlineSnapshot(`
      [
        "TENANT_SCHEMA_AUDIT.md",
        "combined_migrations.sql",
        "migrations/",
        "pending/",
      ]
    `);
  });
});

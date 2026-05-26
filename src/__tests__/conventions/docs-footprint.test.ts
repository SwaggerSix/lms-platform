import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Catches doc sprawl. Snapshots:
 *   - Top-level .md files (README, CHANGELOG, CLAUDE, etc.)
 *   - Files under docs/
 *
 * New top-level doc files often duplicate existing material (one
 * more "overview" or "getting started"). Forcing the addition to
 * show up in the diff makes it easy to ask "is this material new,
 * or should it merge into CHANGELOG / docs/conventions.md?".
 */

function listMarkdown(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md") && statSync(join(dir, name)).isFile())
    .sort();
}

describe("docs footprint", () => {
  it("top-level markdown files", () => {
    const files = listMarkdown(process.cwd());
    expect(files).toMatchInlineSnapshot(`
      [
        "CHANGELOG.md",
        "CLAUDE.md",
        "DEPLOYMENT.md",
        "README.md",
      ]
    `);
  });

  it("docs/ directory contents", () => {
    const files = listMarkdown(join(process.cwd(), "docs"));
    expect(files).toMatchInlineSnapshot(`
      [
        "README.md",
        "conventions.md",
        "migrations.md",
        "tenant-schema-audit.md",
      ]
    `);
  });

  it("docs/archived/ — historical reference docs", () => {
    // Anything that lands here is intentionally not part of the
    // active doc surface. Snapshotting catches accidental archives
    // (someone moving a current doc) and accidental un-archives.
    const files = listMarkdown(join(process.cwd(), "docs/archived"));
    expect(files).toMatchInlineSnapshot(`
      [
        "IMPLEMENTATION_PLAN.md",
        "README.md",
      ]
    `);
  });

  it("top-level and docs/archived/ sets are disjoint (no double-listed file)", () => {
    // Catches the move-to-archive that forgets to update one of the
    // snapshots: if a file appears in both, the active list still
    // sees it. README.md is excluded — it's conventionally
    // per-directory, so the top-level project README and the
    // archive's index README can coexist.
    const top = new Set(listMarkdown(process.cwd()));
    const archived = listMarkdown(join(process.cwd(), "docs/archived"));
    const both = archived.filter(
      (name) => name !== "README.md" && top.has(name)
    );
    expect(
      both,
      "These files exist in both the top-level and docs/archived/. Move-to-archive should be a `git mv`, not a copy."
    ).toEqual([]);
  });
});

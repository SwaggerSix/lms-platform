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
        "IMPLEMENTATION_PLAN.md",
        "README.md",
      ]
    `);
  });

  it("docs/ directory contents", () => {
    const files = listMarkdown(join(process.cwd(), "docs"));
    expect(files).toMatchInlineSnapshot(`
      [
        "conventions.md",
        "migrations.md",
      ]
    `);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";

/**
 * Snapshot maintenance hygiene: when a single convention test fails
 * on snapshot mismatch, `vitest -u <that-file>` should refresh only
 * that file's snapshots. If a snapshot lives in a shared resource
 * (a shared .snap file, a module-level snapshot map), an unrelated
 * convention update would ripple.
 *
 * Vitest's inline snapshots live inside their own test files via
 * `toMatchInlineSnapshot`, so isolation is the default. This test
 * exists to catch a regression where someone introduces an external
 * snapshot file under __snapshots__/ — at which point we'd want to
 * audit it explicitly rather than have it silently shared.
 */

describe("snapshot isolation", () => {
  it("no __snapshots__ directories under src/__tests__/conventions", () => {
    const dir = join(process.cwd(), "src/__tests__/conventions");
    const stray: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name === "__snapshots__") {
        stray.push(join(dir, entry.name));
      }
    }
    expect(stray).toEqual([]);
  });

  it("no .snap files under src/__tests__/", () => {
    const files = walkFiles(join(process.cwd(), "src/__tests__"), {
      extensions: [".snap"],
    });
    expect(files).toEqual([]);
  });

  it("every toMatchInlineSnapshot is in the same file as the it() block that owns it", () => {
    // Sanity-check that the snapshot bodies haven't been factored out
    // into separate fixture files (which would defeat isolation).
    const conventionFiles = walkFiles(join(process.cwd(), "src/__tests__/conventions"));
    for (const file of conventionFiles) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("toMatchInlineSnapshot")) continue;
      // The expected shape: `toMatchInlineSnapshot(\`` followed by
      // the snapshot text in the same file. A regression would be
      // calling toMatchInlineSnapshot with a string variable
      // imported from elsewhere.
      const calls = source.matchAll(/toMatchInlineSnapshot\(([^)]*)/g);
      for (const m of calls) {
        const arg = m[1].trim();
        // Empty arg is allowed (vitest fills on first run); a
        // backtick-string is the normal case.
        expect(
          arg === "" || arg.startsWith("`"),
          `${file.replace(process.cwd() + "/", "")} has a toMatchInlineSnapshot with a non-literal argument: ${arg.slice(0, 60)}`
        ).toBe(true);
      }
    }
  });
});

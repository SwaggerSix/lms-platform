import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * README.md and CHANGELOG.md carry GitHub Actions status badges
 * pointing at workflow files. A bad URL (typo, wrong workflow
 * name) silently renders as a broken image — the CI status looks
 * "unknown" to a reader without anyone noticing.
 *
 * This guard parses badge URLs from the markdown and asserts each
 * workflow file actually exists in .github/workflows/.
 */

const README = readFileSync(join(process.cwd(), "README.md"), "utf8");

describe("README badges", () => {
  it("every workflow referenced exists at .github/workflows/<name>.yml", () => {
    // Match `actions/workflows/<name>.yml` inside badge URLs.
    const refs = Array.from(
      README.matchAll(/actions\/workflows\/([A-Za-z0-9_-]+)\.yml/g)
    ).map((m) => m[1]);
    // Dedupe (each workflow shows up in both the badge URL and the
    // link-to-Actions URL).
    const unique = Array.from(new Set(refs)).sort();

    expect(unique.length, "README references at least one workflow").toBeGreaterThan(0);
    for (const name of unique) {
      const path = join(process.cwd(), `.github/workflows/${name}.yml`);
      expect(existsSync(path), `.github/workflows/${name}.yml exists`).toBe(true);
    }
  });

  it("badge URLs all point at the same swaggersix/lms-platform repo", () => {
    const repos = Array.from(
      README.matchAll(/github\.com\/([^/]+\/[^/]+)\/actions/g)
    ).map((m) => m[1]);
    const unique = Array.from(new Set(repos));
    expect(unique).toEqual(["swaggersix/lms-platform"]);
  });
});

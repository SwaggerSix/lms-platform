import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";

/**
 * GitHub Actions status badges in markdown point at workflow
 * files. A typo silently renders as a broken image — CI status
 * looks "unknown" to readers without anyone noticing.
 *
 * Scan every markdown file under the repo and assert:
 *   - Each referenced workflow file actually exists in
 *     .github/workflows/.
 *   - Every repo path anchors to swaggersix/lms-platform (catches
 *     copy-paste from a fork or template).
 *
 * Walks all .md files rather than hard-coding README so a new doc
 * (CHANGELOG, docs/README, etc.) picking up badges is covered
 * without a test update.
 */

function readAllMarkdown(): { file: string; source: string }[] {
  const root = process.cwd();
  return walkFiles(root, { extensions: [".md"] })
    .filter((p) => !p.includes("/node_modules/") && !p.includes("/.next/"))
    .map((p) => ({ file: p.replace(root + "/", ""), source: readFileSync(p, "utf8") }));
}

describe("workflow badges across all markdown", () => {
  it("every referenced workflow exists at .github/workflows/<name>.yml", () => {
    const missing: Array<{ file: string; workflow: string }> = [];
    for (const { file, source } of readAllMarkdown()) {
      const refs = Array.from(
        source.matchAll(/actions\/workflows\/([A-Za-z0-9_-]+)\.yml/g)
      ).map((m) => m[1]);
      for (const name of new Set(refs)) {
        const path = join(process.cwd(), `.github/workflows/${name}.yml`);
        if (!existsSync(path)) missing.push({ file, workflow: name });
      }
    }
    expect(
      missing,
      `Markdown files reference workflow files that don't exist: ${JSON.stringify(missing, null, 2)}`
    ).toEqual([]);
  });

  it("repo paths in workflow links anchor to swaggersix/lms-platform", () => {
    const offenders: Array<{ file: string; repo: string }> = [];
    for (const { file, source } of readAllMarkdown()) {
      const repos = Array.from(
        source.matchAll(/github\.com\/([^/\s]+\/[^/\s]+)\/actions/g)
      ).map((m) => m[1]);
      for (const repo of new Set(repos)) {
        if (repo !== "swaggersix/lms-platform") {
          offenders.push({ file, repo });
        }
      }
    }
    expect(
      offenders,
      `Workflow badges/links point at a non-swaggersix repo: ${JSON.stringify(offenders, null, 2)}`
    ).toEqual([]);
  });
});

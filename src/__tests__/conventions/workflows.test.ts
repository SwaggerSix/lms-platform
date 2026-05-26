import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Snapshot the .github/workflows/*.yml files: their filenames,
 * the `name:` they declare, and the trigger types they use. Each
 * change here affects what CI runs and when — surface them as a
 * deliberate diff in PR review.
 *
 * Loose YAML parsing: regex-match `name:` and the `on:` block's
 * trigger keys (push, pull_request, schedule, etc.). Full YAML
 * parse isn't worth a new dep for the structure we care about.
 */

const WORKFLOWS_DIR = join(process.cwd(), ".github/workflows");

interface Summary {
  file: string;
  name: string;
  triggers: string[];
}

function summarize(file: string): Summary {
  const source = readFileSync(join(WORKFLOWS_DIR, file), "utf8");
  const name = source.match(/^name:\s*(\S.*?)\s*$/m)?.[1] ?? "(unnamed)";
  // Walk lines starting at `on:`; collect 2-space-indented keys
  // until indent returns to zero (next top-level YAML block).
  const triggers: string[] = [];
  const lines = source.split("\n");
  let inOnBlock = false;
  for (const line of lines) {
    if (!inOnBlock) {
      if (line.startsWith("on:")) inOnBlock = true;
      continue;
    }
    // Exit when a non-indented, non-blank, non-comment line shows up.
    if (/^[^\s#]/.test(line)) break;
    const m = line.match(/^  ([a-z_]+):/);
    if (m) triggers.push(m[1]);
  }
  return { file, name, triggers: triggers.sort() };
}

describe(".github/workflows", () => {
  it("workflow summaries are snapshotted", () => {
    const files = readdirSync(WORKFLOWS_DIR)
      .filter((n) => n.endsWith(".yml"))
      .sort();
    const summaries = files.map(summarize);
    expect(summaries).toMatchInlineSnapshot(`
      [
        {
          "file": "build.yml",
          "name": "Build",
          "triggers": [
            "pull_request",
            "push",
          ],
        },
        {
          "file": "conventions.yml",
          "name": "Conventions",
          "triggers": [
            "pull_request",
            "push",
          ],
        },
        {
          "file": "tests.yml",
          "name": "Tests",
          "triggers": [
            "pull_request",
            "push",
          ],
        },
      ]
    `);
  });
});

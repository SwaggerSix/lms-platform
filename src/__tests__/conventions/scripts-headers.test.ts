import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every script under `scripts/` should open with a JSDoc-style
 * header so a future maintainer landing in `git blame` (or `ls`)
 * can answer: what does this do, how do I run it. The
 * scripts-footprint guard catches new files; this guard makes
 * sure they ship with a header.
 *
 * Heuristic: the first non-shebang non-blank line is `/**` (start
 * of a JSDoc block) and the block contains a "Run:" line spelling
 * out the invocation.
 */

describe("scripts/ file headers", () => {
  it("every .mjs file opens with a /** header containing a Run: line", () => {
    const dir = join(process.cwd(), "scripts");
    const offenders: Array<{ file: string; reason: string }> = [];

    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".mjs")) continue;
      const path = join(dir, name);
      if (!statSync(path).isFile()) continue;
      const lines = readFileSync(path, "utf8").split("\n");

      // Skip shebang + blank lines to find the first content line.
      let i = 0;
      if (lines[i]?.startsWith("#!")) i++;
      while (i < lines.length && lines[i].trim() === "") i++;

      if (!lines[i]?.startsWith("/**")) {
        offenders.push({ file: name, reason: "no leading /** header" });
        continue;
      }

      // Walk the block until `*/`. Look for a Run / Run with /
      // Usage line inside.
      let hasRun = false;
      for (; i < lines.length; i++) {
        if (/\b(Run(?:\s+with)?|Usage):/i.test(lines[i])) hasRun = true;
        if (lines[i].includes("*/")) break;
      }
      if (!hasRun) {
        offenders.push({ file: name, reason: "header lacks `Run:` / `Run with:` / `Usage:` invocation" });
      }
    }

    expect(
      offenders,
      `Each script in scripts/ should start with a JSDoc header that includes a 'Run: …' line. Offenders: ${JSON.stringify(offenders, null, 2)}`
    ).toEqual([]);
  });
});

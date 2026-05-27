import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";
import { isAnyAnnotationLine } from "@/lib/testing/scan-casts";

/**
 * Advisory ratchet over `: any` type annotations (params, vars,
 * members) — a related escape-hatch surface to `as-any-audit`.
 *
 * Count-only (no per-file snapshot): the surface spans ~120 files,
 * so a collapsed file list would churn on every touched file
 * without adding signal. The ceiling alone prevents growth; each
 * PR that types an annotation lowers MAX.
 */

describe("any-annotation audit (advisory)", () => {
  it("`: any` annotation count under src/ stays under the ceiling", () => {
    const files = walkFiles(join(process.cwd(), "src"), {
      extensions: [".ts", ".tsx"],
    });
    let count = 0;
    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      if (rel.startsWith("src/__tests__/")) continue;
      // The detector module defines the pattern, so its own source
      // self-matches — exclude it.
      if (rel === "src/lib/testing/scan-casts.ts") continue;
      const lines = readFileSync(file, "utf8").split("\n");
      for (const line of lines) {
        if (isAnyAnnotationLine(line)) count++;
      }
    }

    const MAX = 330;
    expect(
      count,
      `\`: any\` annotations: ${count}. Ceiling ${MAX}. Replace with real types and lower MAX.`
    ).toBeLessThanOrEqual(MAX);
  });
});

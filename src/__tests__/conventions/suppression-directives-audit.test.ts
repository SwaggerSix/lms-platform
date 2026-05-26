import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";

/**
 * Tracks type-checker / linter suppression directives — another
 * escape-hatch surface alongside `as-any-audit`.
 *
 *  - `@ts-ignore` / `@ts-expect-error`: HARD zero. The codebase has
 *    none; keep it that way (prefer a typed fix or a scoped cast).
 *  - `eslint-disable*`: advisory snapshot. Each is a scoped, named
 *    suppression; the set should stay small and every addition is a
 *    deliberate diff.
 *
 * Test files are excluded (fixtures legitimately carry directives).
 */

describe("suppression directives audit", () => {
  const files = walkFiles(join(process.cwd(), "src"), {
    extensions: [".ts", ".tsx"],
  }).filter((f) => !f.replace(process.cwd() + "/", "").startsWith("src/__tests__/"));

  it("no @ts-ignore / @ts-expect-error in source (hard zero)", () => {
    const sites: string[] = [];
    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (/@ts-ignore|@ts-expect-error/.test(lines[i])) sites.push(`${rel}:${i + 1}`);
      }
    }
    expect(
      sites,
      `TS suppressions should be replaced with a typed fix or a scoped cast: ${JSON.stringify(sites, null, 2)}`
    ).toEqual([]);
  });

  it("eslint-disable sites are snapshotted (advisory)", () => {
    const counts = new Map<string, number>();
    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      const lines = readFileSync(file, "utf8").split("\n");
      for (const line of lines) {
        if (line.includes("eslint-disable")) counts.set(rel, (counts.get(rel) ?? 0) + 1);
      }
    }
    const collapsed = Array.from(counts.entries())
      .map(([file, n]) => (n === 1 ? file : `${file} ×${n}`))
      .sort();
    expect(collapsed).toMatchInlineSnapshot(`
      [
        "src/app/(dashboard)/admin/audit-log/audit-log-client.tsx",
        "src/app/(dashboard)/learn/assessments/[id]/assessment-taking-client.tsx ×2",
        "src/app/(dashboard)/learn/player/[courseId]/player-client.tsx ×2",
        "src/app/embed/[token]/page.tsx",
        "src/lib/cron/monitor.ts",
      ]
    `);
  });
});

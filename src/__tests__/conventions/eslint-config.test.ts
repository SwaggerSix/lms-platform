import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Next 16 removed the `next lint` subcommand, which silently broke
 * `npm run lint` (and therefore the pre-push gate) until a flat
 * `eslint.config.mjs` was added and the script repointed at the
 * ESLint CLI. This guardrail keeps that wiring from regressing:
 *
 *  - the `lint` script must invoke `eslint`, not the removed
 *    `next lint`;
 *  - `eslint.config.mjs` must register the parser + plugins the
 *    codebase's inline disable directives depend on.
 *
 * Snapshot-style so a future Next bump or config edit that drops a
 * plugin shows up as a deliberate diff.
 */

const ROOT = process.cwd();

describe("eslint config wiring", () => {
  it("lint script uses the eslint CLI, not the removed `next lint`", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const lint = pkg.scripts?.lint ?? "";
    expect(lint).toContain("eslint");
    expect(lint).not.toContain("next lint");
  });

  it("check script still chains lint + tsc + conventions", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const check = pkg.scripts?.check ?? "";
    expect(check).toContain("lint");
    expect(check).toContain("tsc --noEmit");
    expect(check).toContain("test:conventions");
  });

  it("eslint.config.mjs registers the parser + plugins the tree relies on", () => {
    const source = readFileSync(join(ROOT, "eslint.config.mjs"), "utf8");
    for (const dep of [
      "@next/eslint-plugin-next",
      "@typescript-eslint/parser",
      "@typescript-eslint/eslint-plugin",
      "eslint-plugin-react-hooks",
    ]) {
      expect(source, `imports ${dep}`).toContain(dep);
    }
  });

  it("applies the next core-web-vitals + recommended rule sets", () => {
    const source = readFileSync(join(ROOT, "eslint.config.mjs"), "utf8");
    expect(source).toContain("core-web-vitals");
    expect(source).toContain("recommended");
  });
});

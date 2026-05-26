import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Policy guardrails on the dependency tree. Complementary to
 * dependencies-ratchet.test.ts:
 *
 *   - dependencies-ratchet snapshots the full set of package names
 *     so any addition / removal shows up in the PR diff.
 *   - this file enforces softer policies (soft cap on count,
 *     required-packages allowlist, banned-packages denylist,
 *     no-second-date-library rule).
 *
 * Both intentional. The ratchet catches *unknown* changes; the
 * footprint catches *unwanted* changes.
 */
const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const deps = pkg.dependencies ?? {};
const devDeps = pkg.devDependencies ?? {};

describe("dependency footprint", () => {
  it("runtime dependency count stays under the soft cap", () => {
    const count = Object.keys(deps).length;
    // Bump this only with a deliberate review comment in the PR.
    expect(count).toBeLessThanOrEqual(40);
  });

  it("keeps the expected core packages installed", () => {
    const required = [
      "@supabase/supabase-js",
      "@supabase/ssr",
      "next",
      "react",
      "react-dom",
      "zustand",
      "date-fns",
      "cron-parser",
      "lucide-react",
    ];
    for (const pkgName of required) {
      expect(deps[pkgName], `${pkgName} should be a runtime dependency`).toBeDefined();
    }
  });

  it("does not pull in banned/deprecated packages", () => {
    const banned = [
      "request", // deprecated, replaced by undici/fetch
      "moment", // replaced by date-fns
      "lodash", // we use native + small utils
    ];
    for (const pkgName of banned) {
      expect(deps[pkgName], `${pkgName} is banned — see test for reasons`).toBeUndefined();
      expect(devDeps[pkgName], `${pkgName} is banned (devDep)`).toBeUndefined();
    }
  });

  it("does not pin a second date library alongside date-fns", () => {
    // Avoid the trap where someone npm-installs dayjs/luxon for one util
    // and we end up shipping three calendaring libraries.
    const dateLibs = ["dayjs", "luxon", "moment"];
    const present = dateLibs.filter((d) => deps[d] || devDeps[d]);
    expect(present, `Found extra date libraries: ${present.join(", ")}`).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guardrails against accidental dependency creep.
 *
 * - Hard cap on the total dependency count, set ~10% above current. Forces
 *   intentional review when a new dep gets added.
 * - Allowlist of "policy-relevant" packages we want to keep an eye on (date
 *   libraries, http clients, supabase ecosystem). The list isn't strict
 *   pinning — it just makes drift visible in PR review.
 * - Bans known-bad replacements that occasionally sneak in via auto-fix
 *   tooling (e.g. `request`, which is deprecated).
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

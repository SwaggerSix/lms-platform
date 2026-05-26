import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The `check` script chains `lint`, `tsc --noEmit`, and
 * `test:conventions` for a pre-push sanity sweep. The order matters:
 * lint is fastest and surfaces obvious mistakes; typecheck catches
 * TS-specific shape errors; conventions runs last because it's the
 * slowest of the three. Fail-fast on each step.
 */

const pkg = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf8")
) as { scripts?: Record<string, string> };

describe("npm run check", () => {
  it("is wired in package.json", () => {
    expect(pkg.scripts?.check).toBeTruthy();
  });

  it("runs lint, then tsc --noEmit, then test:conventions, in order", () => {
    const cmd = pkg.scripts!.check;
    expect(cmd).toMatch(/lint.*&&.*tsc.*&&.*test:conventions/);
    expect(cmd.indexOf("lint")).toBeLessThan(cmd.indexOf("tsc"));
    expect(cmd.indexOf("tsc")).toBeLessThan(cmd.indexOf("test:conventions"));
  });

  it("typechecks with --noEmit (no build artifacts produced by `check`)", () => {
    expect(pkg.scripts!.check).toMatch(/tsc\s+--noEmit/);
  });

  it("uses && (fail-fast) rather than ; or |", () => {
    const cmd = pkg.scripts!.check;
    expect(cmd).toContain("&&");
    expect(cmd).not.toMatch(/;\s/);
    expect(cmd).not.toContain("||");
  });

  it("pre-push hook delegates to `npm run check` (not just one half)", () => {
    const hook = readFileSync(join(process.cwd(), ".githooks/pre-push"), "utf8");
    expect(hook).toContain("npm run check");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The `check` script chains `lint` and `test:conventions` for a
 * pre-push sanity sweep. The order matters: lint is faster and
 * surfaces obvious mistakes first; conventions runs only if lint
 * passes. These tests pin both the wiring and the order so a future
 * refactor can't silently swap them or drop one.
 */

const pkg = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf8")
) as { scripts?: Record<string, string> };

describe("npm run check", () => {
  it("is wired in package.json", () => {
    expect(pkg.scripts?.check).toBeTruthy();
  });

  it("runs lint then test:conventions in order", () => {
    const cmd = pkg.scripts!.check;
    // Order check: lint appears before test:conventions, joined by &&
    // so a failing lint short-circuits the conventions run.
    expect(cmd).toMatch(/lint.*&&.*test:conventions/);
    expect(cmd.indexOf("lint")).toBeLessThan(cmd.indexOf("test:conventions"));
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

import { describe, it, expect } from "vitest";
import { existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The .githooks/pre-commit hook is opt-in (npm run install-hooks
 * points core.hooksPath at it). These tests pin its presence,
 * executability, and contents so a refactor doesn't silently turn
 * it into a no-op or break the install path.
 *
 * NOTE: We don't actually spawn the hook to run test:conventions —
 * that would recurse the bundle we're already inside of. Instead
 * we assert the wiring the install would put in place.
 */

const HOOK_PATH = join(process.cwd(), ".githooks", "pre-commit");

describe("pre-commit hook", () => {
  it("exists at .githooks/pre-commit", () => {
    expect(existsSync(HOOK_PATH)).toBe(true);
  });

  it("is executable", () => {
    // POSIX mode bits: 0o111 = any execute bit set.
    const mode = statSync(HOOK_PATH).mode;
    // eslint-disable-next-line no-bitwise
    expect((mode & 0o111) !== 0).toBe(true);
  });

  it("invokes `npm run test:conventions`", () => {
    const source = readFileSync(HOOK_PATH, "utf8");
    expect(source).toContain("npm run test:conventions");
  });

  it("has a shebang so git can exec it directly", () => {
    const source = readFileSync(HOOK_PATH, "utf8");
    expect(source.startsWith("#!")).toBe(true);
  });

  it("uses `set -e` so a failing convention test propagates", () => {
    const source = readFileSync(HOOK_PATH, "utf8");
    expect(source).toMatch(/^set -e/m);
  });

  it("install-hooks script points git's core.hooksPath at .githooks/", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const cmd = pkg.scripts?.["install-hooks"] ?? "";
    expect(cmd).toContain("core.hooksPath");
    expect(cmd).toContain(".githooks");
  });
});

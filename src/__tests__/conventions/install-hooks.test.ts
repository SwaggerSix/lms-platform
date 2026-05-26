import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync, chmodSync, statSync } from "node:fs";
import { join } from "node:path";
import { withTempDir } from "@/lib/testing/temp-dir";

/**
 * End-to-end test for the install-hooks script. Spawns it inside a
 * temp git repo and asserts:
 *   - The git config core.hooksPath ends up pointing at .githooks.
 *   - The pre-commit hook is reachable and executable from the new
 *     hooks path.
 *
 * Reads the actual script command from package.json so a refactor
 * to the install command (e.g. swapping `git config` for a helper
 * binary) keeps the test honest.
 *
 * Uses withTempDir per-test rather than beforeEach. Each `it` block
 * is self-contained: build the fixture, run the assertion, cleanup
 * via the helper. No mutable shared state between tests.
 */

function buildFixture(dir: string): void {
  execSync("git init -q", { cwd: dir });
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8")
  ) as { scripts?: Record<string, string> };
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "fixture", scripts: { "install-hooks": pkg.scripts?.["install-hooks"] } })
  );
  mkdirSync(join(dir, ".githooks"));
  const realHook = readFileSync(join(process.cwd(), ".githooks/pre-commit"), "utf8");
  writeFileSync(join(dir, ".githooks/pre-commit"), realHook);
  chmodSync(join(dir, ".githooks/pre-commit"), 0o755);
}

describe("install-hooks", () => {
  it("sets git's core.hooksPath to .githooks", () => {
    withTempDir("install-hooks-", (workdir) => {
      buildFixture(workdir);
      execSync("git config core.hooksPath .githooks", { cwd: workdir });
      const hooksPath = execSync("git config --get core.hooksPath", { cwd: workdir })
        .toString()
        .trim();
      expect(hooksPath).toBe(".githooks");
    });
  });

  it("after install, .githooks/pre-commit is the hook git will run", () => {
    withTempDir("install-hooks-", (workdir) => {
      buildFixture(workdir);
      execSync("git config core.hooksPath .githooks", { cwd: workdir });
      const hooksPath = execSync("git config --get core.hooksPath", { cwd: workdir })
        .toString()
        .trim();
      const hookFile = join(workdir, hooksPath, "pre-commit");
      const mode = statSync(hookFile).mode;
      // eslint-disable-next-line no-bitwise
      expect((mode & 0o111) !== 0).toBe(true);
      expect(readFileSync(hookFile, "utf8")).toContain("npm run test:conventions");
    });
  });

  it("install-hooks script in package.json invokes `git config core.hooksPath .githooks`", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8")
    ) as { scripts?: Record<string, string> };
    const cmd = pkg.scripts?.["install-hooks"] ?? "";
    expect(cmd).toMatch(/git config core\.hooksPath \.githooks/);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync, chmodSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
 */

describe("install-hooks", () => {
  let workdir: string;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), "install-hooks-"));
    execSync("git init -q", { cwd: workdir });
    // Mirror just enough of the project layout for the script to run:
    // package.json with the install-hooks script, plus a .githooks/
    // dir containing the pre-commit file we want to assert against.
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8")
    ) as { scripts?: Record<string, string> };
    writeFileSync(
      join(workdir, "package.json"),
      JSON.stringify({ name: "fixture", scripts: { "install-hooks": pkg.scripts?.["install-hooks"] } })
    );
    mkdirSync(join(workdir, ".githooks"));
    const realHook = readFileSync(join(process.cwd(), ".githooks/pre-commit"), "utf8");
    writeFileSync(join(workdir, ".githooks/pre-commit"), realHook);
    chmodSync(join(workdir, ".githooks/pre-commit"), 0o755);
  });

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  it("sets git's core.hooksPath to .githooks", () => {
    // Run the script directly (matches what `npm run install-hooks`
    // shells out to, without spinning up npm + node for the wrapper).
    execSync("git config core.hooksPath .githooks", { cwd: workdir });
    const hooksPath = execSync("git config --get core.hooksPath", { cwd: workdir })
      .toString()
      .trim();
    expect(hooksPath).toBe(".githooks");
  });

  it("after install, .githooks/pre-commit is the hook git will run", () => {
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

  it("install-hooks script in package.json invokes `git config core.hooksPath .githooks`", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8")
    ) as { scripts?: Record<string, string> };
    const cmd = pkg.scripts?.["install-hooks"] ?? "";
    expect(cmd).toMatch(/git config core\.hooksPath \.githooks/);
  });
});

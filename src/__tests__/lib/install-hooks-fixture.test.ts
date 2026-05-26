import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { withTempDir } from "@/lib/testing/temp-dir";
import { buildInstallHooksFixture } from "@/lib/testing/install-hooks-fixture";

/**
 * Unit-test the install-hooks fixture builder so a regression
 * (e.g. accidentally dropping the chmod or copying the wrong
 * source) shows up locally instead of inside the install-hooks
 * end-to-end test where the failure mode is one step removed.
 */

describe("buildInstallHooksFixture", () => {
  it("initializes a git repo in the target dir", () => {
    withTempDir("ih-fixture-", (dir) => {
      buildInstallHooksFixture(dir);
      expect(existsSync(join(dir, ".git"))).toBe(true);
      // sanity: `git status` should succeed (would throw if not a repo).
      execSync("git status -s", { cwd: dir });
    });
  });

  it("writes a package.json with an install-hooks script copied from the live repo", () => {
    withTempDir("ih-fixture-", (dir) => {
      buildInstallHooksFixture(dir);
      const fixture = JSON.parse(
        readFileSync(join(dir, "package.json"), "utf8")
      ) as { scripts?: Record<string, string> };
      expect(fixture.scripts?.["install-hooks"]).toBeTruthy();
      // The live script invokes `git config core.hooksPath .githooks`;
      // the fixture should carry the same.
      expect(fixture.scripts!["install-hooks"]).toContain("git config core.hooksPath");
    });
  });

  it("drops an executable .githooks/pre-commit identical to the live hook", () => {
    withTempDir("ih-fixture-", (dir) => {
      buildInstallHooksFixture(dir);
      const hook = join(dir, ".githooks/pre-commit");
      expect(existsSync(hook)).toBe(true);
      // eslint-disable-next-line no-bitwise
      expect((statSync(hook).mode & 0o111) !== 0).toBe(true);
      const fixtureSrc = readFileSync(hook, "utf8");
      const liveSrc = readFileSync(join(process.cwd(), ".githooks/pre-commit"), "utf8");
      expect(fixtureSrc).toBe(liveSrc);
    });
  });
});

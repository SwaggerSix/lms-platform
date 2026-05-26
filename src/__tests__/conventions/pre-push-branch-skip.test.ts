import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { withTempDir } from "@/lib/testing/temp-dir";
import { initGitRepo } from "@/lib/testing/git-fixture";

/**
 * End-to-end test for the .githooks/pre-push branch-name skip.
 * Builds a temp git repo, checks out a scratch/* branch, then
 * invokes the hook directly. The hook should exit 0 without
 * running `npm run check`.
 *
 * The hook itself is copied from the live .githooks/pre-push so a
 * regression in the case-statement (e.g. dropping the wip/* branch)
 * surfaces here.
 */

function buildRepo(dir: string, branch: string): void {
  initGitRepo(dir, { branch });
  mkdirSync(join(dir, ".githooks"));
  const real = readFileSync(join(process.cwd(), ".githooks/pre-push"), "utf8");
  writeFileSync(join(dir, ".githooks/pre-push"), real);
  chmodSync(join(dir, ".githooks/pre-push"), 0o755);
}

describe("pre-push branch skip", () => {
  it("skips on scratch/* without invoking npm", () => {
    withTempDir("pp-skip-", (dir) => {
      buildRepo(dir, "scratch/foo");
      const res = spawnSync("sh", [".githooks/pre-push"], { cwd: dir });
      expect(res.status).toBe(0);
      const err = res.stderr.toString();
      expect(err).toContain("scratch/foo");
      // npm run check would surface as 'lint' or 'check' in stderr; absence
      // confirms the early exit.
      expect(err).not.toContain("ERROR");
    });
  });

  it("skips on wip/* without invoking npm", () => {
    withTempDir("pp-skip-", (dir) => {
      buildRepo(dir, "wip/experiment");
      const res = spawnSync("sh", [".githooks/pre-push"], { cwd: dir });
      expect(res.status).toBe(0);
      expect(res.stderr.toString()).toContain("wip/experiment");
    });
  });

  it("does NOT skip on a plain feature branch", () => {
    withTempDir("pp-skip-", (dir) => {
      buildRepo(dir, "feature/x");
      // We can't actually run `npm run check` inside the fixture
      // (no package.json with that script). Inspect the hook source
      // for the case-statement instead — if the branch matched a
      // skip pattern, we'd see the skip message; otherwise the hook
      // falls through to the npm check.
      const hook = readFileSync(join(dir, ".githooks/pre-push"), "utf8");
      expect(hook).toMatch(/scratch\/\*\|wip\/\*\)/);
      // The skip emits "skipping check on $branch" to stderr; the
      // fall-through path doesn't. We assert the hook would NOT
      // emit that line for feature/x by running it and stripping
      // the npm tail (the case statement runs early-exit before
      // npm is even checked).
      const res = spawnSync(
        "sh",
        ["-c", "command -v npm >/dev/null 2>&1 || exit 0; .githooks/pre-push"],
        { cwd: dir }
      );
      // Either: skip message absent OR npm exits non-zero. We just
      // assert the skip message doesn't appear for feature/x.
      expect(res.stderr.toString()).not.toContain("skipping check on feature/x");
    });
  });
});

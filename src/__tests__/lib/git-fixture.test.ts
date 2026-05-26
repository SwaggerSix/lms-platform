import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { withTempDir } from "@/lib/testing/temp-dir";
import { initGitRepo } from "@/lib/testing/git-fixture";

describe("initGitRepo", () => {
  it("creates a working git repo with user + signing config", () => {
    withTempDir("gitfix-", (dir) => {
      initGitRepo(dir, { initialCommit: false });
      expect(existsSync(join(dir, ".git"))).toBe(true);
      const email = execSync("git config user.email", { cwd: dir }).toString().trim();
      const sign = execSync("git config commit.gpgsign", { cwd: dir }).toString().trim();
      expect(email).toBe("t@t");
      expect(sign).toBe("false");
    });
  });

  it("with initialCommit: true (default) produces a committed repo", () => {
    withTempDir("gitfix-", (dir) => {
      initGitRepo(dir);
      const log = execSync("git log --oneline", { cwd: dir }).toString();
      expect(log).toContain("init");
    });
  });

  it("checks out the requested branch", () => {
    withTempDir("gitfix-", (dir) => {
      initGitRepo(dir, { branch: "feature/x" });
      const branch = execSync("git symbolic-ref --short HEAD", { cwd: dir })
        .toString()
        .trim();
      expect(branch).toBe("feature/x");
    });
  });

  it("stays on git's default initial branch when none is requested", () => {
    withTempDir("gitfix-", (dir) => {
      initGitRepo(dir);
      const branch = execSync("git symbolic-ref --short HEAD", { cwd: dir })
        .toString()
        .trim();
      // Default branch name varies (`master` historically, `main`
      // on newer git installs, or whatever init.defaultBranch is
      // set to). Just assert something came back and it isn't one
      // of our scratch/wip patterns by accident.
      expect(branch).toBeTruthy();
      expect(branch).not.toMatch(/^(scratch|wip)\//);
    });
  });
});

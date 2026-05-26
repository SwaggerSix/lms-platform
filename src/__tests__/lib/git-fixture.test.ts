import { describe, it, expect } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withTempDir } from "@/lib/testing/temp-dir";
import { initGitRepo, installHook } from "@/lib/testing/git-fixture";

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

describe("installHook", () => {
  it("writes an executable hook with a shebang", () => {
    withTempDir("gitfix-hook-", (dir) => {
      initGitRepo(dir, { initialCommit: false });
      installHook(dir, "pre-commit", "exit 1");
      const path = join(dir, ".git/hooks/pre-commit");
      expect(existsSync(path)).toBe(true);
      const source = readFileSync(path, "utf8");
      expect(source.startsWith("#!")).toBe(true);
      expect(source).toContain("exit 1");
      // eslint-disable-next-line no-bitwise
      expect((statSync(path).mode & 0o111) !== 0).toBe(true);
    });
  });

  it("a failing pre-commit blocks `git commit`", () => {
    withTempDir("gitfix-hook-", (dir) => {
      initGitRepo(dir);
      installHook(dir, "pre-commit", "echo HOOK_RAN\nexit 1");
      writeFileSync(join(dir, "y"), "");
      execSync("git add y", { cwd: dir });
      const res = spawnSync("git", ["commit", "-m", "should fail"], {
        cwd: dir,
      });
      expect(res.status).not.toBe(0);
      const combined = res.stdout.toString() + res.stderr.toString();
      expect(combined).toContain("HOOK_RAN");
    });
  });

  it("the same hook is bypassed by --no-verify", () => {
    withTempDir("gitfix-hook-", (dir) => {
      initGitRepo(dir);
      installHook(dir, "pre-commit", "echo HOOK_RAN\nexit 1");
      writeFileSync(join(dir, "z"), "");
      execSync("git add z", { cwd: dir });
      const res = spawnSync(
        "git",
        ["commit", "--no-verify", "-m", "bypass"],
        { cwd: dir }
      );
      expect(res.status).toBe(0);
      const combined = res.stdout.toString() + res.stderr.toString();
      expect(combined).not.toContain("HOOK_RAN");
    });
  });
});

import { describe, it, expect } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { withTempDir } from "@/lib/testing/temp-dir";
import { initGitRepo } from "@/lib/testing/git-fixture";

/**
 * End-to-end test for scripts/safe-bypass.sh. Spawns it inside a
 * temp git repo with staged + unstaged changes and asserts:
 *   - The staged tree gets committed.
 *   - The unstaged changes survive (stash → pop).
 *   - The hooks don't run (since we passed --no-verify under the
 *     hood, install a pre-commit that would otherwise fail).
 *
 * @infra
 */

function installFailingHook(dir: string): void {
  mkdirSync(join(dir, ".git/hooks"), { recursive: true });
  writeFileSync(
    join(dir, ".git/hooks/pre-commit"),
    "#!/usr/bin/env sh\necho HOOK_RAN\nexit 1\n"
  );
  execSync(`chmod +x ${join(dir, ".git/hooks/pre-commit")}`);
}

describe("safe-bypass.sh", () => {
  it("commits staged tree, restores unstaged changes, skips hooks", () => {
    withTempDir("safe-bypass-", (dir) => {
      initGitRepo(dir);
      installFailingHook(dir);
      copyFileSync(
        join(process.cwd(), "scripts/safe-bypass.sh"),
        join(dir, "safe-bypass.sh")
      );
      execSync(`chmod +x ${join(dir, "safe-bypass.sh")}`);

      // Staged change: a new file we're about to commit.
      writeFileSync(join(dir, "staged.txt"), "committed content");
      execSync("git add staged.txt", { cwd: dir });

      // Unstaged change: edit to an existing tracked file.
      writeFileSync(join(dir, ".gitkeep"), "modified content");

      const res = spawnSync("sh", ["./safe-bypass.sh", "bypass test"], {
        cwd: dir,
      });
      expect(res.status, res.stderr.toString()).toBe(0);

      // Hook would have echoed HOOK_RAN if invoked; --no-verify
      // skips it.
      const combined = res.stdout.toString() + res.stderr.toString();
      expect(combined).not.toContain("HOOK_RAN");

      // The new commit references the staged file.
      const last = execSync("git log -1 --name-only --pretty=", {
        cwd: dir,
      })
        .toString()
        .trim();
      expect(last).toContain("staged.txt");

      // The unstaged edit survived stash → pop.
      const onDisk = readFileSync(join(dir, ".gitkeep"), "utf8");
      expect(onDisk).toBe("modified content");
    });
  });

  it("errors and preserves stash when no message is supplied", () => {
    withTempDir("safe-bypass-", (dir) => {
      initGitRepo(dir);
      copyFileSync(
        join(process.cwd(), "scripts/safe-bypass.sh"),
        join(dir, "safe-bypass.sh")
      );
      execSync(`chmod +x ${join(dir, "safe-bypass.sh")}`);
      const res = spawnSync("sh", ["./safe-bypass.sh"], { cwd: dir });
      expect(res.status).not.toBe(0);
      expect(res.stderr.toString()).toContain("usage:");
    });
  });
});

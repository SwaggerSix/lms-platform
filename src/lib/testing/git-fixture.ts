// Test-only helper. See src/lib/testing/walk.ts for the module's
// scope rules (production code must not import from this directory).

import { execSync } from "node:child_process";
import { writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";

interface InitGitRepoOptions {
  /** Branch to check out after the initial commit. Defaults to the repo's default branch. */
  branch?: string;
  /** Whether to make an initial commit (default: true). */
  initialCommit?: boolean;
}

/**
 * Initialize a temp git repo with the boilerplate test code needs:
 *
 *   - `git init`
 *   - `user.email` / `user.name` set (otherwise `git commit` errors)
 *   - `commit.gpgsign false` so inherited signing config doesn't
 *     block a test from committing. Several CI / dev environments
 *     (this one included) inject signing infrastructure that
 *     interferes with the bare commits a fixture wants to make.
 *   - Optional initial commit + branch checkout so a test can
 *     immediately run hooks / observe the branch.
 *
 * Pass an existing temp directory (typically from `withTempDir`)
 * as `dir`. The helper doesn't manage the directory lifecycle.
 */
export function initGitRepo(dir: string, options: InitGitRepoOptions = {}): void {
  const { branch, initialCommit = true } = options;
  execSync("git init -q", { cwd: dir });
  execSync("git config user.email t@t", { cwd: dir });
  execSync("git config user.name t", { cwd: dir });
  execSync("git config commit.gpgsign false", { cwd: dir });
  if (initialCommit) {
    writeFileSync(join(dir, ".gitkeep"), "");
    execSync("git add .gitkeep", { cwd: dir });
    execSync("git commit --no-gpg-sign -q -m init", { cwd: dir });
  }
  if (branch) {
    execSync(`git checkout -q -b ${branch}`, { cwd: dir });
  }
}

/**
 * Drop an executable hook into the repo's `.git/hooks/` (so `git
 * commit` will run it). Useful for tests that want to verify
 * bypass behavior — e.g. `installHook(dir, "pre-commit", "exit 1")`
 * fails any commit that doesn't pass `--no-verify`.
 *
 * Writes a shebang automatically; the `body` is the script body
 * minus the shebang.
 */
export function installHook(
  dir: string,
  hook: "pre-commit" | "pre-push" | "commit-msg" | "prepare-commit-msg",
  body: string
): void {
  const hooksDir = join(dir, ".git/hooks");
  mkdirSync(hooksDir, { recursive: true });
  const path = join(hooksDir, hook);
  writeFileSync(path, `#!/usr/bin/env sh\n${body}\n`);
  chmodSync(path, 0o755);
}

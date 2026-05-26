// Test-only helper. See src/lib/testing/walk.ts for the module's
// scope rules (production code must not import from this directory).

import { readFileSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { initGitRepo } from "./git-fixture";

/**
 * Build a minimal project layout inside `dir` that mimics this repo
 * enough to exercise `npm run install-hooks` and the resulting
 * .githooks behavior. Drops:
 *
 *   - a fresh git repo (so `git config` writes somewhere)
 *   - a package.json whose `install-hooks` script copies the live
 *     value from this repo's package.json
 *   - a copy of the real .githooks/pre-commit at the same path
 *
 * Lives outside the test file so any future test that needs the
 * same fixture (e.g. coverage for a new git-hook surface) can
 * reuse it.
 */
export function buildInstallHooksFixture(dir: string): void {
  // initialCommit:false — the install-hooks test only inspects
  // config, not commit history, so no need to spend time committing.
  initGitRepo(dir, { initialCommit: false });
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8")
  ) as { scripts?: Record<string, string> };
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "fixture",
      scripts: { "install-hooks": pkg.scripts?.["install-hooks"] },
    })
  );
  mkdirSync(join(dir, ".githooks"));
  const realHook = readFileSync(join(process.cwd(), ".githooks/pre-commit"), "utf8");
  writeFileSync(join(dir, ".githooks/pre-commit"), realHook);
  chmodSync(join(dir, ".githooks/pre-commit"), 0o755);
}

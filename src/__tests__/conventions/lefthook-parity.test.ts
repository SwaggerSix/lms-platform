import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * lefthook.yml and .githooks/ are two install paths for the same
 * hook contract. If one is updated (e.g. swap test:conventions for
 * a new bundle name) and the other isn't, a contributor on the
 * lagging install would silently miss the gate.
 *
 * This test diffs the two by matching the npm run targets each
 * configures — keeps them in lockstep without prescribing exact YAML
 * formatting.
 */

const ROOT = process.cwd();

function extractNpmRunTargets(source: string): string[] {
  // Match `npm run <target>` on non-comment lines only (skip shell
  // comment lines starting with `#`). YAML comment lines also start
  // with `#`, so the same filter works for both file types.
  return source
    .split("\n")
    .filter((ln) => !/^\s*#/.test(ln))
    .flatMap((ln) =>
      Array.from(ln.matchAll(/npm\s+run\s+([A-Za-z0-9:_-]+)/g)).map((m) => m[1])
    );
}

describe("lefthook.yml ↔ .githooks/ parity", () => {
  it("both pre-commit paths invoke the same npm run targets", () => {
    const native = readFileSync(join(ROOT, ".githooks/pre-commit"), "utf8");
    const lefthook = readFileSync(join(ROOT, "lefthook.yml"), "utf8");
    const nativeTargets = extractNpmRunTargets(native);
    // Pull just the pre-commit block out of lefthook.yml so the
    // pre-push targets don't leak in.
    const preCommitBlock = lefthook
      .split(/^pre-push:/m)[0]
      .split(/^pre-commit:/m)[1] ?? "";
    const lefthookTargets = extractNpmRunTargets(preCommitBlock);
    expect(nativeTargets.sort()).toEqual(lefthookTargets.sort());
  });

  it("both pre-push paths invoke the same npm run targets", () => {
    const native = readFileSync(join(ROOT, ".githooks/pre-push"), "utf8");
    const lefthook = readFileSync(join(ROOT, "lefthook.yml"), "utf8");
    const nativeTargets = extractNpmRunTargets(native);
    const prePushBlock = lefthook.split(/^pre-push:/m)[1] ?? "";
    const lefthookTargets = extractNpmRunTargets(prePushBlock);
    expect(nativeTargets.sort()).toEqual(lefthookTargets.sort());
  });

  it("lefthook.yml exists alongside .githooks/ (both install paths shipped)", () => {
    expect(existsSync(join(ROOT, "lefthook.yml"))).toBe(true);
    expect(existsSync(join(ROOT, ".githooks/pre-commit"))).toBe(true);
    expect(existsSync(join(ROOT, ".githooks/pre-push"))).toBe(true);
  });
});

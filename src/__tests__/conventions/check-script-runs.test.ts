import { describe, it, expect } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import { withTempDir } from "@/lib/testing/temp-dir";
import { buildCheckScriptFixture } from "@/lib/testing/check-script-fixture";

/**
 * The check-script test pins the wire shape (string match on
 * `lint && tsc && test:conventions`). This file goes further:
 * spawns each step against a deliberately broken fixture and
 * asserts the chain fails-fast at the right link.
 *
 * @infra
 */

describe("npm run check fail-fast behavior (fixture)", () => {
  it("runs all three steps in order when each passes", () => {
    withTempDir("check-fixture-", (workdir) => {
      buildCheckScriptFixture(workdir, { lintExit: 0, tscExit: 0 });
      const out = execSync("npm run check --silent", { cwd: workdir }).toString();
      const lintIdx = out.indexOf("LINT");
      const tscIdx = out.indexOf("TSC");
      const convIdx = out.indexOf("CONV");
      expect(lintIdx).toBeGreaterThanOrEqual(0);
      expect(tscIdx).toBeGreaterThan(lintIdx);
      expect(convIdx).toBeGreaterThan(tscIdx);
    });
  });

  it("short-circuits if lint fails (tsc + conventions don't run)", () => {
    withTempDir("check-fixture-", (workdir) => {
      buildCheckScriptFixture(workdir, { lintExit: 1, tscExit: 0 });
      const res = spawnSync("npm", ["run", "check", "--silent"], { cwd: workdir });
      expect(res.status).not.toBe(0);
      const combined = res.stdout.toString() + res.stderr.toString();
      expect(combined).toContain("LINT");
      expect(combined).not.toContain("TSC");
      expect(combined).not.toContain("CONV");
    });
  });

  it("short-circuits if tsc fails (conventions don't run)", () => {
    withTempDir("check-fixture-", (workdir) => {
      buildCheckScriptFixture(workdir, { lintExit: 0, tscExit: 2 });
      const res = spawnSync("npm", ["run", "check", "--silent"], { cwd: workdir });
      expect(res.status).not.toBe(0);
      const combined = res.stdout.toString() + res.stderr.toString();
      expect(combined).toContain("LINT");
      expect(combined).toContain("TSC");
      expect(combined).not.toContain("CONV");
    });
  });
});

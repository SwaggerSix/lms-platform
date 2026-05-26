import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withTempDir } from "@/lib/testing/temp-dir";
import { buildCheckScriptFixture } from "@/lib/testing/check-script-fixture";

/**
 * Unit-test the check-script fixture builder. Same reasoning as
 * install-hooks-fixture.test.ts: a regression in the helper shows up
 * here rather than inside check-script-runs.test.ts where the
 * failure mode is one step removed.
 */

describe("buildCheckScriptFixture", () => {
  it("writes a package.json with the three-step check chain", () => {
    withTempDir("cs-fixture-", (dir) => {
      buildCheckScriptFixture(dir, { lintExit: 0, tscExit: 0 });
      const pkg = JSON.parse(
        readFileSync(join(dir, "package.json"), "utf8")
      ) as { scripts?: Record<string, string> };
      expect(pkg.scripts?.check).toBe(
        "npm run lint && npm run tsc && npm run test:conventions"
      );
      expect(pkg.scripts?.lint).toContain("echo LINT");
      expect(pkg.scripts?.tsc).toContain("./tsc-stub.js");
      expect(pkg.scripts?.["test:conventions"]).toContain("echo CONV");
    });
  });

  it("creates a tsc stub at the path the lint script references", () => {
    withTempDir("cs-fixture-", (dir) => {
      buildCheckScriptFixture(dir, { lintExit: 0, tscExit: 0 });
      const stub = join(dir, "tsc-stub.js");
      expect(existsSync(stub)).toBe(true);
      expect(readFileSync(stub, "utf8")).toContain("console.log('TSC')");
    });
  });

  it("propagates lintExit into the lint stub command", () => {
    withTempDir("cs-fixture-", (dir) => {
      buildCheckScriptFixture(dir, { lintExit: 1, tscExit: 0 });
      const res = spawnSync("npm", ["run", "lint", "--silent"], { cwd: dir });
      expect(res.status).not.toBe(0);
      expect(res.stdout.toString()).toContain("LINT");
    });
  });

  it("propagates tscExit into the tsc stub script", () => {
    withTempDir("cs-fixture-", (dir) => {
      buildCheckScriptFixture(dir, { lintExit: 0, tscExit: 2 });
      const res = spawnSync("npm", ["run", "tsc", "--silent"], { cwd: dir });
      expect(res.status).toBe(2);
      expect(res.stdout.toString()).toContain("TSC");
    });
  });

  it("creates a node_modules directory so npm doesn't complain", () => {
    withTempDir("cs-fixture-", (dir) => {
      buildCheckScriptFixture(dir, { lintExit: 0, tscExit: 0 });
      expect(existsSync(join(dir, "node_modules"))).toBe(true);
    });
  });
});

import { describe, it, expect } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { withTempDir } from "@/lib/testing/temp-dir";

/**
 * The check-script test pins the wire shape (string match on
 * `lint && tsc && test:conventions`). This file goes further:
 * spawns each step against a deliberately broken fixture and
 * asserts the chain fails-fast at the right link.
 *
 * Uses a temp project with stub scripts so the spawn doesn't
 * recursively run the live convention bundle (which would run
 * inside the bundle that's running this test). withTempDir per-it
 * because each case writes a slightly different package.json and
 * shouldn't see another case's edits.
 */

interface Stubs {
  lintExit: 0 | 1;
  tscExit: 0 | 1 | 2;
}

function buildFixture(dir: string, stubs: Stubs): void {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "check-fixture",
      scripts: {
        lint: `echo LINT && exit ${stubs.lintExit}`,
        tsc: "node ./tsc-stub.js",
        "test:conventions": "echo CONV && exit 0",
        check: "npm run lint && npm run tsc && npm run test:conventions",
      },
    })
  );
  mkdirSync(join(dir, "node_modules"), { recursive: true });
  writeFileSync(
    join(dir, "tsc-stub.js"),
    `console.log('TSC');process.exit(${stubs.tscExit});`
  );
}

describe("npm run check fail-fast behavior (fixture)", () => {
  it("runs all three steps in order when each passes", () => {
    withTempDir("check-fixture-", (workdir) => {
      buildFixture(workdir, { lintExit: 0, tscExit: 0 });
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
      buildFixture(workdir, { lintExit: 1, tscExit: 0 });
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
      buildFixture(workdir, { lintExit: 0, tscExit: 2 });
      const res = spawnSync("npm", ["run", "check", "--silent"], { cwd: workdir });
      expect(res.status).not.toBe(0);
      const combined = res.stdout.toString() + res.stderr.toString();
      expect(combined).toContain("LINT");
      expect(combined).toContain("TSC");
      expect(combined).not.toContain("CONV");
    });
  });
});

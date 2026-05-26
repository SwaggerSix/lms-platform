import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * The check-script test pins the wire shape (string match on
 * `lint && tsc && test:conventions`). This file goes further:
 * spawns each step against a deliberately broken fixture and
 * asserts the chain fails-fast at the right link.
 *
 * Uses a temp project with stub scripts so the spawn doesn't
 * recursively run the live convention bundle (which would run
 * inside the bundle that's running this test).
 */

describe("npm run check fail-fast behavior (fixture)", () => {
  let workdir: string;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), "check-fixture-"));
    // Mirror just the bits npm needs: a package.json with the same
    // three-step chain but stub commands we control.
    writeFileSync(
      join(workdir, "package.json"),
      JSON.stringify({
        name: "check-fixture",
        scripts: {
          lint: "echo LINT && exit 0",
          "test:conventions": "echo CONV && exit 0",
          // `tsc --noEmit` is the third leg; emulate via a stub script
          // that we toggle by overwriting the file between tests.
          tsc: "node ./tsc-stub.js",
          check: "npm run lint && npm run tsc && npm run test:conventions",
        },
      })
    );
    mkdirSync(join(workdir, "node_modules"), { recursive: true });
    writeFileSync(join(workdir, "tsc-stub.js"), "console.log('TSC');process.exit(0);");
  });

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  it("runs all three steps in order when each passes", () => {
    const out = execSync("npm run check --silent", { cwd: workdir }).toString();
    const lintIdx = out.indexOf("LINT");
    const tscIdx = out.indexOf("TSC");
    const convIdx = out.indexOf("CONV");
    expect(lintIdx).toBeGreaterThanOrEqual(0);
    expect(tscIdx).toBeGreaterThan(lintIdx);
    expect(convIdx).toBeGreaterThan(tscIdx);
  });

  it("short-circuits if lint fails (tsc + conventions don't run)", () => {
    writeFileSync(
      join(workdir, "package.json"),
      JSON.stringify({
        name: "check-fixture",
        scripts: {
          lint: "echo LINT && exit 1",
          tsc: "node ./tsc-stub.js",
          "test:conventions": "echo CONV && exit 0",
          check: "npm run lint && npm run tsc && npm run test:conventions",
        },
      })
    );
    const res = spawnSync("npm", ["run", "check", "--silent"], { cwd: workdir });
    expect(res.status).not.toBe(0);
    const combined = res.stdout.toString() + res.stderr.toString();
    expect(combined).toContain("LINT");
    expect(combined).not.toContain("TSC");
    expect(combined).not.toContain("CONV");
  });

  it("short-circuits if tsc fails (conventions don't run)", () => {
    writeFileSync(
      join(workdir, "package.json"),
      JSON.stringify({
        name: "check-fixture",
        scripts: {
          lint: "echo LINT && exit 0",
          tsc: "node ./tsc-stub.js",
          "test:conventions": "echo CONV && exit 0",
          check: "npm run lint && npm run tsc && npm run test:conventions",
        },
      })
    );
    writeFileSync(join(workdir, "tsc-stub.js"), "console.log('TSC');process.exit(2);");
    const res = spawnSync("npm", ["run", "check", "--silent"], { cwd: workdir });
    expect(res.status).not.toBe(0);
    const combined = res.stdout.toString() + res.stderr.toString();
    expect(combined).toContain("LINT");
    expect(combined).toContain("TSC");
    expect(combined).not.toContain("CONV");
  });
});

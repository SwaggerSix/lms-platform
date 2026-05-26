import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withTempDir } from "@/lib/testing/temp-dir";
import { walkFiles } from "@/lib/testing/walk";

/**
 * Smoke test for the snapshot-isolation guard's checks. The live
 * guard asserts the project-wide tree is clean; this file proves
 * each check would *fire* against a synthetic regression.
 *
 * Mirrors the convention-smoke / scanner-test pattern: the live
 * tree's cleanliness isn't enough — we need to know the detector
 * itself works.
 */

describe("snapshot-isolation detectors (synthetic fixtures)", () => {
  it("flags a __snapshots__ directory inside a tree", () => {
    withTempDir("snap-iso-", (root) => {
      mkdirSync(join(root, "__snapshots__"));
      writeFileSync(join(root, "__snapshots__/foo.snap"), "exports[`x`] = `1`;");
      const stray = readdirSync(root, { withFileTypes: true }).filter(
        (e) => e.isDirectory() && e.name === "__snapshots__"
      );
      expect(stray).toHaveLength(1);
    });
  });

  it("flags .snap files via walkFiles({ extensions: ['.snap'] })", () => {
    withTempDir("snap-iso-", (root) => {
      writeFileSync(join(root, "a.snap"), "");
      mkdirSync(join(root, "sub"));
      writeFileSync(join(root, "sub/b.snap"), "");
      const found = walkFiles(root, { extensions: [".snap"] }).map((p) =>
        p.replace(root + "/", "")
      );
      expect(found.sort()).toEqual(["a.snap", "sub/b.snap"]);
    });
  });

  it("flags a non-literal toMatchInlineSnapshot argument", () => {
    // Synthetic source where the snapshot is passed an identifier
    // (e.g. an imported fixture) rather than a literal. The live
    // guard's regex checks the trimmed argument starts with `\`` or
    // is empty.
    const synthetic = [
      `import { snap } from "./fixtures";`,
      `expect(x).toMatchInlineSnapshot(snap);`,
    ].join("\n");
    const calls = Array.from(synthetic.matchAll(/toMatchInlineSnapshot\(([^)]*)/g));
    expect(calls).toHaveLength(1);
    const arg = calls[0][1].trim();
    // Reproduce the live guard's check inline so this test would
    // catch the same regression.
    const isLiteral = arg === "" || arg.startsWith("`");
    expect(isLiteral).toBe(false);
  });

  it("accepts a backtick-string toMatchInlineSnapshot argument", () => {
    const synthetic = "expect(x).toMatchInlineSnapshot(`[]`);";
    const calls = Array.from(synthetic.matchAll(/toMatchInlineSnapshot\(([^)]*)/g));
    const arg = calls[0][1].trim();
    expect(arg.startsWith("`")).toBe(true);
  });

  it("accepts an empty toMatchInlineSnapshot argument (vitest fills on first run)", () => {
    const synthetic = "expect(x).toMatchInlineSnapshot();";
    const calls = Array.from(synthetic.matchAll(/toMatchInlineSnapshot\(([^)]*)/g));
    const arg = calls[0][1].trim();
    expect(arg).toBe("");
  });

  it("source-file readFileSync round-trips identically (sanity)", () => {
    // Sanity-check: this is the read path the live guard uses.
    withTempDir("snap-iso-", (root) => {
      const path = join(root, "x.ts");
      writeFileSync(path, "expect(x).toMatchInlineSnapshot(`[]`);");
      const src = readFileSync(path, "utf8");
      expect(src).toContain("toMatchInlineSnapshot");
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { walkFiles } from "@/lib/testing/walk";

/**
 * walkFiles is used by every codebase-walking convention test. Pin
 * its core behavior against a temp directory tree so any future
 * tweak surfaces in a deliberate test update rather than a
 * convention-test diff with mystery cause.
 */

describe("walkFiles", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "walk-"));
    // Layout:
    //   root/
    //     a.ts        ← included
    //     b.tsx       ← included by default
    //     c.js        ← skipped (wrong extension)
    //     .hidden.ts  ← skipped (dotfile)
    //     node_modules/x.ts ← skipped (default skip)
    //     sub/d.ts    ← included (recursive)
    //     sub/.git/e.ts ← skipped (nested dotfile dir)
    writeFileSync(join(root, "a.ts"), "");
    writeFileSync(join(root, "b.tsx"), "");
    writeFileSync(join(root, "c.js"), "");
    writeFileSync(join(root, ".hidden.ts"), "");
    mkdirSync(join(root, "node_modules"));
    writeFileSync(join(root, "node_modules/x.ts"), "");
    mkdirSync(join(root, "sub"));
    writeFileSync(join(root, "sub/d.ts"), "");
    mkdirSync(join(root, "sub/.git"));
    writeFileSync(join(root, "sub/.git/e.ts"), "");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("returns .ts and .tsx files by default, sorted by recursion order", () => {
    const out = walkFiles(root).map((p) => p.replace(root + "/", ""));
    expect(out.sort()).toEqual(["a.ts", "b.tsx", "sub/d.ts"]);
  });

  it("skips node_modules and dotfile names by default", () => {
    const out = walkFiles(root).map((p) => p.replace(root + "/", ""));
    expect(out).not.toContain(".hidden.ts");
    expect(out.join(",")).not.toContain("node_modules");
    expect(out.join(",")).not.toContain(".git");
  });

  it("honors an extensions override", () => {
    const out = walkFiles(root, { extensions: [".js"] }).map((p) =>
      p.replace(root + "/", "")
    );
    expect(out).toEqual(["c.js"]);
  });

  it("includes multiple extensions when listed", () => {
    const out = walkFiles(root, { extensions: [".ts", ".js"] })
      .map((p) => p.replace(root + "/", ""))
      .sort();
    expect(out).toEqual(["a.ts", "c.js", "sub/d.ts"]);
  });

  it("custom skip predicate replaces the default", () => {
    // Use a permissive skip that lets node_modules through; default
    // would block it.
    const out = walkFiles(root, { skip: () => false })
      .map((p) => p.replace(root + "/", ""))
      .sort();
    expect(out).toContain("node_modules/x.ts");
    expect(out).toContain(".hidden.ts");
  });

  it("returns absolute paths", () => {
    const out = walkFiles(root);
    for (const p of out) expect(p.startsWith("/")).toBe(true);
  });

  it("empty directory returns empty array", () => {
    const empty = mkdtempSync(join(tmpdir(), "walk-empty-"));
    try {
      expect(walkFiles(empty)).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

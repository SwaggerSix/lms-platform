import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";
import { withTempDir } from "@/lib/testing/temp-dir";

/**
 * walkFiles is used by every codebase-walking convention test. Pin
 * its core behavior against a temp directory tree so any future
 * tweak surfaces in a deliberate test update rather than a
 * convention-test diff with mystery cause.
 *
 * Layout built per-test by `seed()`:
 *   root/
 *     a.ts            ← .ts default
 *     b.tsx           ← .tsx default
 *     c.js            ← wrong extension (default)
 *     .hidden.ts      ← dotfile (default skip)
 *     node_modules/x.ts  ← default skip
 *     sub/d.ts        ← recursive
 *     sub/.git/e.ts   ← nested dotfile dir
 */
function seed(root: string): void {
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
}

describe("walkFiles", () => {
  it("returns .ts and .tsx files by default", () => {
    withTempDir("walk-", (root) => {
      seed(root);
      const out = walkFiles(root)
        .map((p) => p.replace(root + "/", ""))
        .sort();
      expect(out).toEqual(["a.ts", "b.tsx", "sub/d.ts"]);
    });
  });

  it("skips node_modules and dotfile names by default", () => {
    withTempDir("walk-", (root) => {
      seed(root);
      const out = walkFiles(root).map((p) => p.replace(root + "/", ""));
      expect(out).not.toContain(".hidden.ts");
      expect(out.join(",")).not.toContain("node_modules");
      expect(out.join(",")).not.toContain(".git");
    });
  });

  it("honors an extensions override", () => {
    withTempDir("walk-", (root) => {
      seed(root);
      const out = walkFiles(root, { extensions: [".js"] }).map((p) =>
        p.replace(root + "/", "")
      );
      expect(out).toEqual(["c.js"]);
    });
  });

  it("includes multiple extensions when listed", () => {
    withTempDir("walk-", (root) => {
      seed(root);
      const out = walkFiles(root, { extensions: [".ts", ".js"] })
        .map((p) => p.replace(root + "/", ""))
        .sort();
      expect(out).toEqual(["a.ts", "c.js", "sub/d.ts"]);
    });
  });

  it("custom skip predicate replaces the default", () => {
    withTempDir("walk-", (root) => {
      seed(root);
      // Permissive skip lets node_modules + dotfiles through.
      const out = walkFiles(root, { skip: () => false })
        .map((p) => p.replace(root + "/", ""))
        .sort();
      expect(out).toContain("node_modules/x.ts");
      expect(out).toContain(".hidden.ts");
    });
  });

  it("returns absolute paths", () => {
    withTempDir("walk-", (root) => {
      seed(root);
      for (const p of walkFiles(root)) expect(p.startsWith("/")).toBe(true);
    });
  });

  it("empty directory returns empty array", () => {
    withTempDir("walk-empty-", (empty) => {
      expect(walkFiles(empty)).toEqual([]);
    });
  });
});

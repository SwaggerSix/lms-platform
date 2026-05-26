import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Snapshot the non-comment, non-blank entries of .gitignore.
 * Catches the silent removal of an important ignore (e.g.
 * `.env.local` slipping out of the list would put real secrets one
 * `git add .` away from being committed) and the silent addition
 * of an entry that hides files from review.
 *
 * Comments + blank lines are stripped — those churn freely and
 * aren't worth gating.
 */

describe(".gitignore", () => {
  it("non-comment, non-blank entries are snapshotted", () => {
    const source = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    const entries = source
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("#"))
      .sort();
    expect(entries).toMatchInlineSnapshot(`
      [
        "*.docx",
        "*.pem",
        "*.tsbuildinfo",
        ".DS_Store",
        ".env",
        ".env*.local",
        ".env.development.local",
        ".env.local",
        ".env.production.local",
        ".env.test.local",
        ".next/",
        ".pnp",
        ".pnp.js",
        ".vercel",
        "build/",
        "coverage/",
        "next-env.d.ts",
        "node_modules/",
        "npm-debug.log*",
        "out/",
        "scripts/generate-*.js",
        "scripts/guide-images/",
        "yarn-debug.log*",
        "yarn-error.log*",
      ]
    `);
  });
});

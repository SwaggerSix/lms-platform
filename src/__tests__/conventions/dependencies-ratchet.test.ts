import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Dependency-creep guard. Snapshots the live set of names in
 * package.json's `dependencies` and `devDependencies`. New packages
 * (or removed ones) force a snapshot update in the same commit, which
 * makes additions visible during PR review.
 *
 * The snapshot only tracks names, not versions — version bumps don't
 * need a triage commit. A bumped lockfile via `npm update <pkg>`
 * leaves this test green.
 */

const pkg = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf8")
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

describe("dependency ratchet", () => {
  it("dependency names are snapshotted (catches accidental dep creep)", () => {
    const names = Object.keys(pkg.dependencies ?? {}).sort();
    expect(names).toMatchInlineSnapshot(`
      [
        "@anthropic-ai/sdk",
        "@ducanh2912/next-pwa",
        "@supabase/ssr",
        "@supabase/supabase-js",
        "@tailwindcss/postcss",
        "@types/node",
        "@types/react",
        "@types/react-dom",
        "@types/uuid",
        "autoprefixer",
        "canvas",
        "class-variance-authority",
        "clsx",
        "cron-parser",
        "date-fns",
        "docx",
        "dompurify",
        "jspdf",
        "lucide-react",
        "next",
        "next-intl",
        "openai",
        "postcss",
        "react",
        "react-dom",
        "recharts",
        "resend",
        "tailwind-merge",
        "tailwindcss",
        "typescript",
        "uuid",
        "zod",
        "zustand",
      ]
    `);
  });

  it("devDependency names are snapshotted", () => {
    const names = Object.keys(pkg.devDependencies ?? {}).sort();
    expect(names).toMatchInlineSnapshot(`
      [
        "@testing-library/jest-dom",
        "@testing-library/react",
        "@testing-library/user-event",
        "@types/dompurify",
        "@vitejs/plugin-react",
        "jsdom",
        "pg",
        "postgres",
        "supabase",
        "vitest",
      ]
    `);
  });

  it("npm scripts are snapshotted (catches accidental script churn)", () => {
    const names = Object.keys(pkg.scripts ?? {}).sort();
    expect(names).toMatchInlineSnapshot(`
      [
        "build",
        "check",
        "dev",
        "install-hooks",
        "lint",
        "start",
        "test",
        "test:conventions",
        "test:coverage",
        "test:ui",
        "test:watch",
      ]
    `);
  });
});

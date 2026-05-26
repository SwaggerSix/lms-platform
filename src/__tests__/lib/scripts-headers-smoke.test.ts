import { describe, it, expect } from "vitest";

/**
 * Smoke test for the scripts-headers detector. Mirrors the
 * convention-smoke pattern: feed crafted in-memory sources and
 * assert each is classified as having a valid header or not.
 *
 * Detector logic is duplicated inline rather than imported because
 * the live convention test is a 30-line scanner and pulling it
 * into a shared module adds boilerplate. If it grows, refactor.
 */

function hasValidHeader(source: string): boolean {
  const lines = source.split("\n");
  let i = 0;
  if (lines[i]?.startsWith("#!")) i++;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (!lines[i]?.startsWith("/**")) return false;
  for (; i < lines.length; i++) {
    if (/\b(Run(?:\s+with)?|Usage):/i.test(lines[i])) return true;
    if (lines[i].includes("*/")) break;
  }
  return false;
}

describe("scripts-headers detector (synthetic fixtures)", () => {
  it("accepts a JSDoc header with `Run: …`", () => {
    expect(
      hasValidHeader(`/**\n * Seed the DB.\n * Run: node scripts/seed.mjs\n */\n`)
    ).toBe(true);
  });

  it("accepts `Run with: …` and `Usage: …` variants", () => {
    expect(
      hasValidHeader(`/**\n * Seed.\n * Run with: node scripts/seed.mjs\n */\n`)
    ).toBe(true);
    expect(
      hasValidHeader(`/**\n * Seed.\n * Usage: node scripts/seed.mjs\n */\n`)
    ).toBe(true);
  });

  it("accepts a shebang above the header", () => {
    expect(
      hasValidHeader(
        `#!/usr/bin/env node\n/**\n * Seed.\n * Run: node scripts/seed.mjs\n */\n`
      )
    ).toBe(true);
  });

  it("rejects a script with no header at all", () => {
    expect(hasValidHeader(`import { createClient } from "@supabase/supabase-js";\n`)).toBe(false);
  });

  it("rejects a header missing the Run/Usage line", () => {
    expect(
      hasValidHeader(`/**\n * Seed the DB.\n * Author: someone.\n */\n`)
    ).toBe(false);
  });

  it("rejects a line comment header (// instead of /**)", () => {
    expect(
      hasValidHeader(`// Seed the DB.\n// Run: node scripts/seed.mjs\n`)
    ).toBe(false);
  });

  it("accepts whitespace before the /** opener", () => {
    expect(
      hasValidHeader(`\n\n/**\n * Seed.\n * Run: node scripts/seed.mjs\n */\n`)
    ).toBe(true);
  });
});

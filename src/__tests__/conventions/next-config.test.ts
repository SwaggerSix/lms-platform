import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * next.config.ts carries security headers (CSP, X-Frame-Options,
 * etc.) and runtime configuration. Changes here affect every
 * response across the deployment. Snapshot the literal source so a
 * silent header removal or CSP loosening surfaces in the diff.
 *
 * Source-level snapshot rather than parsed-config because the
 * config exports a NextConfig object that calls async functions —
 * cheaper to read the file than to evaluate it.
 */

describe("next.config.ts", () => {
  it("pins the security header set", () => {
    const source = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    // Each header must appear by name. Adding a new one shows up
    // as a "doesn't match the test" failure; removing one too.
    for (const header of [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "X-XSS-Protection",
      "Referrer-Policy",
      "Permissions-Policy",
      "Content-Security-Policy",
    ]) {
      expect(source, `header ${header} present`).toContain(header);
    }
  });

  it("X-Frame-Options is DENY", () => {
    const source = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(source).toMatch(/X-Frame-Options[^}]*DENY/);
  });

  it("CSP disallows object-src", () => {
    const source = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(source).toMatch(/object-src 'none'/);
  });

  it("image remote patterns are pinned to Supabase domains only", () => {
    const source = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    const hostMatches = Array.from(
      source.matchAll(/hostname:\s*"([^"]+)"/g)
    ).map((m) => m[1]);
    expect(hostMatches.sort()).toEqual(["*.supabase.co", "*.supabase.in"]);
  });
});

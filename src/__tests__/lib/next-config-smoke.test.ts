import { describe, it, expect } from "vitest";

/**
 * Smoke test for the next-config guardrail's checks. The live
 * guard asserts the project config is clean; this file proves
 * each detection rule fires against synthetic regressions.
 *
 * Same pattern as convention-smoke / scripts-headers-smoke.
 */

const SECURITY_HEADERS = [
  "X-Content-Type-Options",
  "X-Frame-Options",
  "X-XSS-Protection",
  "Referrer-Policy",
  "Permissions-Policy",
  "Content-Security-Policy",
];

function hasAllSecurityHeaders(source: string): boolean {
  return SECURITY_HEADERS.every((h) => source.includes(h));
}

function isFrameOptionsDeny(source: string): boolean {
  return /X-Frame-Options[^}]*DENY/.test(source);
}

function cspDisallowsObjectSrc(source: string): boolean {
  return /object-src 'none'/.test(source);
}

function imageHostnames(source: string): string[] {
  return Array.from(source.matchAll(/hostname:\s*"([^"]+)"/g)).map((m) => m[1]).sort();
}

describe("next-config detector (synthetic fixtures)", () => {
  it("accepts the full header set", () => {
    const src = SECURITY_HEADERS.map((h) => `{ key: "${h}", value: "x" }`).join(",");
    expect(hasAllSecurityHeaders(src)).toBe(true);
  });

  it("flags a missing CSP", () => {
    const src = SECURITY_HEADERS.filter((h) => h !== "Content-Security-Policy")
      .map((h) => `{ key: "${h}", value: "x" }`)
      .join(",");
    expect(hasAllSecurityHeaders(src)).toBe(false);
  });

  it("flags X-Frame-Options set to SAMEORIGIN instead of DENY", () => {
    expect(isFrameOptionsDeny(`{ key: "X-Frame-Options", value: "SAMEORIGIN" }`)).toBe(false);
    expect(isFrameOptionsDeny(`{ key: "X-Frame-Options", value: "DENY" }`)).toBe(true);
  });

  it("flags a CSP that loosens object-src", () => {
    expect(cspDisallowsObjectSrc(`script-src 'self'; object-src 'self'`)).toBe(false);
    expect(cspDisallowsObjectSrc(`script-src 'self'; object-src 'none'`)).toBe(true);
  });

  it("flags an extra image hostname being added", () => {
    const allowed = `hostname: "*.supabase.co"\nhostname: "*.supabase.in"`;
    const sneaky = `${allowed}\nhostname: "evil.example.com"`;
    expect(imageHostnames(allowed)).toEqual(["*.supabase.co", "*.supabase.in"]);
    expect(imageHostnames(sneaky)).toEqual([
      "*.supabase.co",
      "*.supabase.in",
      "evil.example.com",
    ]);
  });
});

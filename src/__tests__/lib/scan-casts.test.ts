import { describe, it, expect } from "vitest";
import { AS_ANY_RE, isAsAnyLine } from "@/lib/testing/scan-casts";

/**
 * Unit + smoke test for the `as any` detector behind as-any-audit.
 * Pins the matching behavior so a future tweak can't silently change
 * the offender count or start over/under-matching.
 */

describe("AS_ANY_RE", () => {
  it("matches a bare `as any` cast", () => {
    expect(AS_ANY_RE.test("const x = foo as any;")).toBe(true);
    expect(AS_ANY_RE.test("(row as any).id")).toBe(true);
    expect(AS_ANY_RE.test("const xs = (data ?? []) as any[];")).toBe(true);
  });

  it("does not match unrelated identifiers containing 'any'", () => {
    expect(AS_ANY_RE.test("const anyValue = 1;")).toBe(false);
    expect(AS_ANY_RE.test("hasAnyRole(user)")).toBe(false);
    expect(AS_ANY_RE.test("const company = x;")).toBe(false);
  });
});

describe("isAsAnyLine", () => {
  it("flags bare `as any`", () => {
    expect(isAsAnyLine("return foo as any;")).toBe(true);
    expect(isAsAnyLine("for (const r of rows as any[]) {")).toBe(true);
  });

  it("does NOT flag `as unknown as T` double-casts (the migration target)", () => {
    expect(isAsAnyLine("const t = x as unknown as Template[];")).toBe(false);
    expect(isAsAnyLine("course={course as unknown as { id: string }}")).toBe(false);
  });

  it("does not flag lines without a cast", () => {
    expect(isAsAnyLine("const ok = role === 'admin';")).toBe(false);
  });
});

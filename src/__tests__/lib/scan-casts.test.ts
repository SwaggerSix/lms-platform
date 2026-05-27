import { describe, it, expect } from "vitest";
import { AS_ANY_RE, isAsAnyLine, isAnyAnnotationLine } from "@/lib/testing/scan-casts";

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

  it("respects the trailing word boundary (no `as anything` / `as anys`)", () => {
    expect(AS_ANY_RE.test("const x = foo as anything;")).toBe(false);
    expect(AS_ANY_RE.test("const x = foo as anys;")).toBe(false);
  });

  it("matches `as any` followed by indexing or generics punctuation", () => {
    expect(AS_ANY_RE.test("foo as any)")).toBe(true);
    expect(AS_ANY_RE.test("foo as any,")).toBe(true);
    expect(AS_ANY_RE.test("Promise<any> as any;")).toBe(true);
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

  it("skips a whole line that also contains `as unknown as` (rare mixed case)", () => {
    // Documents the conservative behavior: a line carrying the
    // sanctioned double-cast is skipped entirely, even if it also
    // has a bare `as any` elsewhere. Such lines are vanishingly
    // rare; the trade-off keeps the detector simple.
    expect(isAsAnyLine("const a = x as unknown as T; const b = y as any;")).toBe(false);
  });
});

describe("isAnyAnnotationLine", () => {
  it("flags `: any` annotations (params, vars, members)", () => {
    expect(isAnyAnnotationLine("function f(x: any) {")).toBe(true);
    expect(isAnyAnnotationLine("let y: any;")).toBe(true);
    expect(isAnyAnnotationLine("type T = { foo: any };")).toBe(true);
    expect(isAnyAnnotationLine("} catch (e: any) {")).toBe(true);
  });

  it("does not flag generic args like `Record<string, any>` (comma, not colon)", () => {
    expect(isAnyAnnotationLine("const m: Record<string, any> = {};")).toBe(false);
  });

  it("does not flag `as any` casts (different surface)", () => {
    expect(isAnyAnnotationLine("const x = foo as any;")).toBe(false);
  });

  it("does not flag unrelated colons", () => {
    expect(isAnyAnnotationLine("const x: string = 'a';")).toBe(false);
    expect(isAnyAnnotationLine("{ key: anyValue }")).toBe(false);
  });
});

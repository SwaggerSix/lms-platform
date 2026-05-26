import { describe, it, expect } from "vitest";
import { MANAGER_EQUALITY_OMISSION_RE } from "@/lib/auth/role-check-patterns";

/**
 * Smoke test for the equality-form manager-or-above detector used
 * by manager-equality-omission-audit. Locks matching behavior and
 * proves the guardrail would fire on a reintroduced site (the
 * codebase walk only proves today's tree is clean).
 *
 * Imports MANAGER_EQUALITY_OMISSION_RE from the live module so the
 * audit and this test can't drift.
 */

describe("manager equality-omission detector", () => {
  it("matches the positive OR form", () => {
    expect(
      MANAGER_EQUALITY_OMISSION_RE.test('role === "admin" || role === "manager"')
    ).toBe(true);
  });

  it("matches the negated AND form", () => {
    expect(
      MANAGER_EQUALITY_OMISSION_RE.test('role !== "admin" && role !== "manager"')
    ).toBe(true);
  });

  it("matches with prefixed role expressions", () => {
    expect(
      MANAGER_EQUALITY_OMISSION_RE.test(
        'auth.user.role === "admin" || auth.user.role === "manager"'
      )
    ).toBe(true);
    expect(
      MANAGER_EQUALITY_OMISSION_RE.test(
        'dbUser.role !== "admin" && dbUser.role !== "manager"'
      )
    ).toBe(true);
  });

  it("does NOT match the canonical helper call", () => {
    expect(MANAGER_EQUALITY_OMISSION_RE.test("!isManagerOrAbove(role)")).toBe(false);
    expect(MANAGER_EQUALITY_OMISSION_RE.test("isManagerOrAbove(auth.user.role)")).toBe(false);
  });

  it("does NOT match a single-role equality (only admin)", () => {
    expect(MANAGER_EQUALITY_OMISSION_RE.test('role === "admin"')).toBe(false);
    expect(MANAGER_EQUALITY_OMISSION_RE.test('role !== "admin"')).toBe(false);
  });

  it("does NOT match the admin/super_admin inequality (different bug class)", () => {
    expect(
      MANAGER_EQUALITY_OMISSION_RE.test('role !== "admin" && role !== "super_admin"')
    ).toBe(false);
  });

  it("flags a reintroduced site inside a synthetic multi-line source", () => {
    const synthetic = `
      export async function GET() {
        const auth = await authorize("admin", "manager", "learner");
        const canManage = auth.user.role === "admin" || auth.user.role === "manager";
        return canManage ? all() : mine();
      }
    `;
    const hits: number[] = [];
    synthetic.split("\n").forEach((line, i) => {
      if (MANAGER_EQUALITY_OMISSION_RE.test(line)) hits.push(i + 1);
    });
    expect(hits).toHaveLength(1);
  });
});

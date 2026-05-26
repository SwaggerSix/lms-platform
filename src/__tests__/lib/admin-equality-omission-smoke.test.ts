import { describe, it, expect } from "vitest";
import { ADMIN_EQUALITY_OMISSION_RE } from "@/lib/auth/role-check-patterns";

/**
 * Smoke test for the bare single-role admin-gate detector used by
 * admin-equality-omission-audit (advisory ratchet). Locks matching
 * behavior so a future tweak doesn't silently change the offender
 * count.
 *
 * Imports ADMIN_EQUALITY_OMISSION_RE from the live module so the
 * audit and this test can't drift.
 */

describe("admin equality-omission detector", () => {
  it("matches the inequality form with a prefix", () => {
    expect(ADMIN_EQUALITY_OMISSION_RE.test('auth.user.role !== "admin"')).toBe(true);
  });

  it("matches the equality form with a prefix", () => {
    expect(ADMIN_EQUALITY_OMISSION_RE.test('dbUser.role === "admin"')).toBe(true);
  });

  it("requires a `.role` member access (avoids object-literal false positives)", () => {
    // `role: "admin"` in an object literal must not match.
    expect(ADMIN_EQUALITY_OMISSION_RE.test('const x = { role: "admin" };')).toBe(false);
    // A bare `role === "admin"` with no member access also doesn't
    // match — the audit only targets `<expr>.role` gates.
    expect(ADMIN_EQUALITY_OMISSION_RE.test('role === "admin"')).toBe(false);
  });

  it("does NOT match the canonical helper call", () => {
    expect(ADMIN_EQUALITY_OMISSION_RE.test("!isAdmin(auth.user.role)")).toBe(false);
  });

  it("matches a line that omits super_admin (the bug this surfaces)", () => {
    // The audit additionally skips lines mentioning super_admin or
    // manager; this test just pins the regex itself.
    expect(ADMIN_EQUALITY_OMISSION_RE.test('if (auth.user.role !== "admin") {')).toBe(true);
  });

  it("flags a reintroduced site inside a synthetic multi-line source", () => {
    const synthetic = `
      export async function PUT() {
        const auth = await authorize();
        if (auth.user.role !== "admin") {
          return forbidden();
        }
        return ok();
      }
    `;
    const hits: number[] = [];
    synthetic.split("\n").forEach((line, i) => {
      if (ADMIN_EQUALITY_OMISSION_RE.test(line)) hits.push(i + 1);
    });
    expect(hits).toHaveLength(1);
  });
});

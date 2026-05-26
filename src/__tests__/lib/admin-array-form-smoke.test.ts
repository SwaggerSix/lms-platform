import { describe, it, expect } from "vitest";
import { ADMIN_SUPER_ADMIN_INCLUDES_RE } from "@/lib/auth/role-check-patterns";

/**
 * Smoke test for the array-form admin-gate detector used by
 * admin-array-form-audit. Locks matching behavior and proves the
 * guardrail would fire on a reintroduced site (the codebase walk
 * only proves today's tree is clean).
 *
 * Imports ADMIN_SUPER_ADMIN_INCLUDES_RE from the live module so
 * the audit and this test can't drift.
 */

describe("admin array-form detector", () => {
  it("matches the canonical form", () => {
    expect(
      ADMIN_SUPER_ADMIN_INCLUDES_RE.test('["admin", "super_admin"].includes(role)')
    ).toBe(true);
  });

  it("matches without the space after the comma", () => {
    expect(
      ADMIN_SUPER_ADMIN_INCLUDES_RE.test('["admin","super_admin"].includes(role)')
    ).toBe(true);
  });

  it("matches when negated and with a prefixed role expression", () => {
    expect(
      ADMIN_SUPER_ADMIN_INCLUDES_RE.test('!["admin", "super_admin"].includes(dbUser.role)')
    ).toBe(true);
  });

  it("does NOT match the canonical helper call", () => {
    expect(ADMIN_SUPER_ADMIN_INCLUDES_RE.test("!isAdmin(role)")).toBe(false);
    expect(ADMIN_SUPER_ADMIN_INCLUDES_RE.test("isAdmin(dbUser.role)")).toBe(false);
  });

  it("does NOT match the admin/manager omission form", () => {
    expect(
      ADMIN_SUPER_ADMIN_INCLUDES_RE.test('["admin", "manager"].includes(role)')
    ).toBe(false);
  });

  it("matches the reversed order (super_admin first)", () => {
    expect(
      ADMIN_SUPER_ADMIN_INCLUDES_RE.test('["super_admin", "admin"].includes(role)')
    ).toBe(true);
  });

  it("flags a reintroduced site inside a synthetic multi-line source", () => {
    const synthetic = `
      export default async function Page() {
        const dbUser = await getUser();
        if (!dbUser || !["admin", "super_admin"].includes(dbUser.role)) {
          redirect("/dashboard");
        }
        return view();
      }
    `;
    const hits: number[] = [];
    synthetic.split("\n").forEach((line, i) => {
      if (ADMIN_SUPER_ADMIN_INCLUDES_RE.test(line)) hits.push(i + 1);
    });
    expect(hits).toHaveLength(1);
  });
});

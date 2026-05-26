import { describe, it, expect } from "vitest";
import { ADMIN_MANAGER_INCLUDES_RE } from "@/lib/auth/role-check-patterns";

/**
 * Smoke test for the array-includes regex used by the
 * super-admin-omission-audit ratchet. Locks the matching behavior
 * so a future tweak (e.g. stricter spacing) doesn't silently start
 * missing or over-matching offender sites.
 *
 * Imports ADMIN_MANAGER_INCLUDES_RE from the live module so the
 * ratchet and this test can't drift.
 */

describe("admin-manager array-includes detector", () => {
  it("matches the canonical form", () => {
    expect(
      ADMIN_MANAGER_INCLUDES_RE.test('["admin", "manager"].includes(role)')
    ).toBe(true);
  });

  it("matches without the space after the comma", () => {
    expect(
      ADMIN_MANAGER_INCLUDES_RE.test('["admin","manager"].includes(role)')
    ).toBe(true);
  });

  it("matches with extra whitespace inside the list", () => {
    expect(
      ADMIN_MANAGER_INCLUDES_RE.test('["admin",   "manager"].includes(role)')
    ).toBe(true);
  });

  it("matches when negated with !", () => {
    expect(
      ADMIN_MANAGER_INCLUDES_RE.test('!["admin", "manager"].includes(role)')
    ).toBe(true);
  });

  it("matches with a prefixed role expression (dbUser.role, auth.user.role)", () => {
    expect(
      ADMIN_MANAGER_INCLUDES_RE.test(
        '["admin", "manager"].includes(dbUser.role)'
      )
    ).toBe(true);
    expect(
      ADMIN_MANAGER_INCLUDES_RE.test(
        '["admin", "manager"].includes(auth.user.role as string)'
      )
    ).toBe(true);
  });

  it("does NOT match the canonical helper call", () => {
    expect(ADMIN_MANAGER_INCLUDES_RE.test("!isManagerOrAbove(role)")).toBe(false);
    expect(ADMIN_MANAGER_INCLUDES_RE.test("isManagerOrAbove(dbUser.role)")).toBe(false);
  });

  it("does NOT match the super_admin-inclusive array form", () => {
    expect(
      ADMIN_MANAGER_INCLUDES_RE.test(
        '["admin", "manager", "super_admin"].includes(role)'
      )
    ).toBe(false);
  });

  it("does NOT match the reversed order (manager first)", () => {
    // Documents the limitation: a reversed-order array would slip
    // through. If someone writes the reversed form we miss it
    // until the regex is widened.
    expect(
      ADMIN_MANAGER_INCLUDES_RE.test('["manager", "admin"].includes(role)')
    ).toBe(false);
  });

  it("does NOT match the two-role admin/super_admin array", () => {
    expect(
      ADMIN_MANAGER_INCLUDES_RE.test('["admin", "super_admin"].includes(role)')
    ).toBe(false);
  });
});

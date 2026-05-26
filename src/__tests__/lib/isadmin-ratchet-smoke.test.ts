import { describe, it, expect } from "vitest";

/**
 * Smoke test for the inequality-form regex used by the
 * isadmin-adoption-ratchet. Locks the matching behavior so a
 * future tweak (e.g. stricter spacing) doesn't silently start
 * missing or over-matching.
 *
 * Regex duplicated inline rather than imported because the live
 * test is small enough that pulling it into a shared module
 * would add boilerplate.
 */

const INEQUALITY_RE =
  /role\s*!==\s*"admin"\s*&&\s*[A-Za-z_.\s]*role\s*!==\s*"super_admin"/;

describe("inequality-form role-check detector", () => {
  it("matches the canonical two-role inequality", () => {
    expect(INEQUALITY_RE.test('role !== "admin" && role !== "super_admin"')).toBe(true);
  });

  it("matches with a prefix on each role reference (dbUser.role / auth.user.role)", () => {
    expect(
      INEQUALITY_RE.test(
        'dbUser.role !== "admin" && dbUser.role !== "super_admin"'
      )
    ).toBe(true);
    expect(
      INEQUALITY_RE.test(
        'auth.user.role !== "admin" && auth.user.role !== "super_admin"'
      )
    ).toBe(true);
  });

  it("tolerates extra whitespace", () => {
    expect(
      INEQUALITY_RE.test(
        'role  !==  "admin"  &&  role  !==  "super_admin"'
      )
    ).toBe(true);
  });

  it("does NOT match the canonical helper call", () => {
    expect(INEQUALITY_RE.test("!isAdmin(role)")).toBe(false);
    expect(INEQUALITY_RE.test("!isAdmin(dbUser.role)")).toBe(false);
  });

  it("does NOT match the array-includes form", () => {
    expect(
      INEQUALITY_RE.test('!["admin", "super_admin"].includes(role)')
    ).toBe(false);
  });

  it("does NOT match a single-role inequality (only one !==)", () => {
    expect(INEQUALITY_RE.test('role !== "admin"')).toBe(false);
  });

  it("does NOT match a reversed-order inequality (super_admin first)", () => {
    // The regex looks for "admin" first then "super_admin"; a
    // reversed form would slip through. Documents the limitation —
    // if someone writes the reversed form we miss it until the
    // regex is widened.
    expect(
      INEQUALITY_RE.test(
        'role !== "super_admin" && role !== "admin"'
      )
    ).toBe(false);
  });
});

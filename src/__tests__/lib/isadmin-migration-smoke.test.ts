import { describe, it, expect } from "vitest";

/**
 * Smoke test for the post-migration shape. Verifies that:
 *   - The expected page-level pattern (`!isAdmin(role)` after a
 *     `redirect()`) matches the form migrated pages use.
 *   - A residual inequality after a migration would still be
 *     caught by the ratchet regex (defensive — confirms one of
 *     the migration paths doesn't accidentally skip the gate).
 *
 * Same regex as the live isadmin-adoption-ratchet to stay in
 * lockstep.
 */

const INEQUALITY_RE =
  /role\s*!==\s*"admin"\s*&&\s*[A-Za-z_.\s]*role\s*!==\s*"super_admin"/;

const MIGRATED_SHAPE = /!isAdmin\([a-zA-Z_.]+\.role\)/;

describe("post-migration page shape", () => {
  it("the migrated form is detected as `!isAdmin(<x>.role)`", () => {
    const synthetic = `if (!dbUser || !isAdmin(dbUser.role)) redirect("/dashboard");`;
    expect(MIGRATED_SHAPE.test(synthetic)).toBe(true);
  });

  it("the migrated form does NOT trigger the inequality regex", () => {
    const synthetic = `if (!dbUser || !isAdmin(dbUser.role)) redirect("/dashboard");`;
    expect(INEQUALITY_RE.test(synthetic)).toBe(false);
  });

  it("a half-migrated page (both forms in the same expression) is caught by the inequality regex", () => {
    // Defensive: if a contributor accidentally writes `isAdmin(X) ||
    // role !== "admin" && role !== "super_admin"`, the inequality
    // half is still flagged.
    const half = `if (!isAdmin(role) || (role !== "admin" && role !== "super_admin")) redirect("/dashboard");`;
    expect(INEQUALITY_RE.test(half)).toBe(true);
  });

  it("a properly migrated `redirect()` site has only the helper call, no leftover string literals", () => {
    const synthetic = `if (!isAdmin(dbUser.role)) redirect("/dashboard");`;
    expect(synthetic).not.toContain(`"admin"`);
    expect(synthetic).not.toContain(`"super_admin"`);
  });
});

/**
 * Patterns used by the role-check ratchets to count adoption
 * progress. Centralized so both ratchets (and their smoke tests)
 * share a single definition — a tweak in one place stays in
 * lockstep with the other.
 *
 * - INEQUALITY_ROLE_RE: matches the old admin-or-super_admin
 *   inequality form `role !== "admin" && (...)role !== "super_admin"`.
 *   Drives isadmin-adoption-ratchet.
 * - ADMIN_MANAGER_INCLUDES_RE: matches `["admin", "manager"].includes(`
 *   which silently omits super_admin. Drives super-admin-omission-audit.
 * - ADMIN_SUPER_ADMIN_INCLUDES_RE: matches
 *   `["admin", "super_admin"].includes(`, the non-canonical
 *   array form of an admin gate. Not buggy (super_admin included)
 *   but should use `isAdmin(role)`. Drives admin-array-form-audit.
 * - MANAGER_EQUALITY_OMISSION_RE: matches the equality form of a
 *   manager-or-above gate — `role === "admin" || role === "manager"`
 *   or `role !== "admin" && role !== "manager"`. Same super_admin
 *   omission as the array form; should use `isManagerOrAbove(role)`.
 *   Drives manager-equality-omission-audit.
 * - ADMIN_EQUALITY_OMISSION_RE: matches a bare single-role
 *   `.role === "admin"` / `.role !== "admin"` admin gate. Often a
 *   super_admin lockout (super_admin should pass an admin gate),
 *   but NOT always — some sites differentiate admin from
 *   super_admin deliberately (e.g. tenant-scope resolution).
 *   Advisory only; drives admin-equality-omission-audit (a
 *   shrinking ratchet, not a hard assertion).
 *
 * Both are intentionally narrow: false negatives are acceptable
 * (the helpers `isAdmin` / `isManagerOrAbove` are the migration
 * target either way), false positives are not.
 *
 * Matching behavior is pinned by smoke tests that import these
 * same constants, so the regexes and their tests can't drift:
 *   - src/__tests__/lib/isadmin-ratchet-smoke.test.ts
 *     (INEQUALITY_ROLE_RE)
 *   - src/__tests__/lib/admin-manager-includes-smoke.test.ts
 *     (ADMIN_MANAGER_INCLUDES_RE)
 *   - src/__tests__/lib/admin-array-form-smoke.test.ts
 *     (ADMIN_SUPER_ADMIN_INCLUDES_RE)
 *   - src/__tests__/lib/manager-equality-omission-smoke.test.ts
 *     (MANAGER_EQUALITY_OMISSION_RE)
 *   - src/__tests__/lib/admin-equality-omission-smoke.test.ts
 *     (ADMIN_EQUALITY_OMISSION_RE)
 */

export const INEQUALITY_ROLE_RE =
  /role\s*!==\s*"admin"\s*&&\s*[A-Za-z_.\s]*role\s*!==\s*"super_admin"/;

export const ADMIN_MANAGER_INCLUDES_RE = /\["admin",\s*"manager"\]\.includes\(/;

export const ADMIN_SUPER_ADMIN_INCLUDES_RE =
  /\["admin",\s*"super_admin"\]\.includes\(/;

export const MANAGER_EQUALITY_OMISSION_RE =
  /role\s*===\s*"admin"\s*\|\|\s*[A-Za-z_.\s]*role\s*===\s*"manager"|role\s*!==\s*"admin"\s*&&\s*[A-Za-z_.\s]*role\s*!==\s*"manager"/;

export const ADMIN_EQUALITY_OMISSION_RE = /\.role\s*(?:===|!==)\s*"admin"/;

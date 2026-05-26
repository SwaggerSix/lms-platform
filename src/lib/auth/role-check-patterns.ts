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
 *
 * Both are intentionally narrow: false negatives are acceptable
 * (the helpers `isAdmin` / `isManagerOrAbove` are the migration
 * target either way), false positives are not.
 */

export const INEQUALITY_ROLE_RE =
  /role\s*!==\s*"admin"\s*&&\s*[A-Za-z_.\s]*role\s*!==\s*"super_admin"/;

export const ADMIN_MANAGER_INCLUDES_RE = /\["admin",\s*"manager"\]\.includes\(/;

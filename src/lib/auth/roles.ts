/**
 * Role-membership helpers. The codebase has historically used three
 * shapes for "is this user admin-or-higher":
 *
 *   role !== "admin" && role !== "super_admin"     // inequality form
 *   !["admin", "super_admin"].includes(role)       // array form
 *   !["admin", "manager"].includes(role)           // missing super_admin (likely a bug — super_admin should pass)
 *
 * All three work locally; the difference is style and (in the
 * third form) a latent permissions bug. Reaching for these helpers
 * standardizes on one shape and quietly fixes the super_admin
 * omission. Existing call sites are fine — leave them alone
 * unless touching the surrounding code (semantic shift for
 * `["admin", "manager"]` sites: super_admin starts passing).
 *
 * Pass any value; non-string inputs return false rather than
 * throwing.
 */

const ADMIN_ROLES: ReadonlySet<string> = new Set(["admin", "super_admin"]);
const MANAGER_OR_ABOVE: ReadonlySet<string> = new Set([
  "admin",
  "super_admin",
  "manager",
]);

export function isAdmin(role: unknown): boolean {
  return typeof role === "string" && ADMIN_ROLES.has(role);
}

export function isManagerOrAbove(role: unknown): boolean {
  return typeof role === "string" && MANAGER_OR_ABOVE.has(role);
}

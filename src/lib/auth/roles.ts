/**
 * Role-membership helpers. The codebase has historically used two
 * shapes for "is this user admin-or-higher":
 *
 *   role !== "admin" && role !== "super_admin"     // inequality form
 *   !["admin", "super_admin"].includes(role)       // array form
 *
 * Both work; the difference is style. Reaching for these helpers
 * standardizes on one shape and shortens call sites that already
 * branch on three roles. Existing inequality-form sites are
 * fine — leave them alone unless touching the surrounding code.
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

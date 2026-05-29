import type { UserRole } from "@/types/database";

export type { UserRole };

/**
 * Role model
 * ----------
 * - super_admin: Internal gothamCulture (gC) / Gotham Government Services (GGS)
 *   staff. Operates across every client organization (tenant) and owns
 *   platform-level configuration (tenants, billing/eCommerce, marketplace,
 *   integrations, cross-tenant analytics, the AI course creator).
 * - admin: A *client* learning leader. Manages learning for their own
 *   organization only — users, courses, reports, etc. scoped to their tenant.
 * - manager / instructor / learner: Standard org-scoped roles.
 *
 * Keep this file as the single source of truth for the gC/GGS vs. client
 * distinction so middleware, API routes, and UI stay in sync.
 */

/** Human-readable labels for each platform role. */
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  instructor: "Instructor",
  learner: "Learner",
};

export function roleLabel(role?: string | null): string {
  return (role && ROLE_LABELS[role as UserRole]) || "Learner";
}

/** Internal gC/GGS staff roles (platform-wide access). */
export const INTERNAL_ROLES: UserRole[] = ["super_admin"];

export function isSuperAdmin(role?: string | null): boolean {
  return role === "super_admin";
}

/**
 * Page-route prefixes reserved for Super Admins (gC/GGS staff). Client Admins
 * (learning leaders) are redirected away from these by the middleware. Keep in
 * sync with the "Platform" sidebar section in components/layout/sidebar.tsx.
 */
export const SUPER_ADMIN_ONLY_PREFIXES = [
  "/admin/tenants",
  "/admin/ecommerce",
  "/admin/marketplace",
  "/admin/courses/ai-create",
  "/admin/analytics/predictive",
  "/admin/settings/xapi",
  "/admin/settings/sso",
  "/admin/settings/integrations/hris",
  "/admin/settings/integrations/teams",
];

export function isSuperAdminOnlyPath(pathname: string): boolean {
  return SUPER_ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

/**
 * Roles a given actor is allowed to assign to other users. Only Super Admins
 * may grant Super Admin; client Admins manage the standard org-level roles.
 */
export function assignableRoles(actorRole?: string | null): UserRole[] {
  if (isSuperAdmin(actorRole)) {
    return ["super_admin", "admin", "manager", "instructor", "learner"];
  }
  return ["admin", "manager", "instructor", "learner"];
}

export function canAssignRole(
  actorRole: string | null | undefined,
  targetRole: string
): boolean {
  return assignableRoles(actorRole).includes(targetRole as UserRole);
}

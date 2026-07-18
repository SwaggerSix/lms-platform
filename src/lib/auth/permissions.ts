import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/types/database";

/**
 * Custom roles / granular permissions (overlay model)
 * ---------------------------------------------------
 * Custom roles do NOT replace the five built-in roles. Every user always keeps
 * one built-in `users.role` (the "base role"), so all existing authorization —
 * `authorize(...roles)` at the API layer, the hardcoded role literals in RLS,
 * and the middleware route gates — keeps working unchanged. A custom role is an
 * overlay on top of a base role: a named permission set that can only *narrow*
 * what that base role is allowed to do (its granted permissions are constrained
 * to a subset of the base role's defaults). This makes it structurally
 * impossible for a custom role to grant a privilege its base role lacks, so no
 * RLS/authorize bypass is possible.
 *
 * Enforcement is at the application layer via `hasPermission()` /
 * `loadEffectivePermissions()`. `super_admin` bypasses permission checks
 * entirely, mirroring `authorize()`.
 */

/** A single grantable permission. */
export interface PermissionDef {
  key: string;
  label: string;
  description: string;
}

/** A group of related permissions, for rendering the management UI. */
export interface PermissionGroup {
  group: string;
  permissions: PermissionDef[];
}

/**
 * The catalog of granular permissions a custom role can grant. Keep dot-scoped
 * keys stable — they are persisted on custom roles and checked in code.
 */
export const PERMISSION_CATALOG: PermissionGroup[] = [
  {
    group: "Courses",
    permissions: [
      { key: "courses.view", label: "View courses", description: "See the course catalog and course detail." },
      { key: "courses.create", label: "Create courses", description: "Author new courses, modules, and lessons." },
      { key: "courses.edit", label: "Edit courses", description: "Modify existing course content." },
      { key: "courses.publish", label: "Publish courses", description: "Publish drafts and cut new course versions." },
      { key: "courses.delete", label: "Delete courses", description: "Archive or delete courses." },
    ],
  },
  {
    group: "People",
    permissions: [
      { key: "users.view", label: "View users", description: "See user records within scope." },
      { key: "users.manage", label: "Manage users", description: "Create, edit, and assign roles to users." },
      { key: "enrollments.manage", label: "Manage enrollments", description: "Enroll and unenroll learners." },
    ],
  },
  {
    group: "Reporting",
    permissions: [
      { key: "reports.view", label: "View reports", description: "Open reports and dashboards." },
      { key: "reports.export", label: "Export reports", description: "Download report data (CSV)." },
      { key: "compliance.view", label: "View compliance", description: "See compliance status and expiry reporting." },
    ],
  },
  {
    group: "Administration",
    permissions: [
      { key: "certifications.manage", label: "Manage certifications", description: "Configure certifications and certificate designs." },
      { key: "settings.manage", label: "Manage settings", description: "Change organization settings and branding." },
      { key: "integrations.manage", label: "Manage integrations", description: "Configure SSO, SCIM, webhooks, and API keys." },
    ],
  },
];

/** Flat list of every valid permission key. */
export const ALL_PERMISSIONS: string[] = PERMISSION_CATALOG.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

/** Base roles a custom role may map onto. `super_admin` is internal-only and
 * is intentionally excluded — custom roles are for client-side delegation. */
export const CUSTOM_ROLE_BASE_ROLES: Exclude<UserRole, "super_admin">[] = [
  "admin",
  "manager",
  "instructor",
  "learner",
];

/**
 * Default permission grant for each built-in role. A user with no custom role
 * gets exactly their base role's defaults. A custom role's granted set is
 * constrained to be a subset of its base role's defaults (see
 * {@link constrainToBase}). `super_admin` gets everything but bypasses checks
 * anyway.
 */
const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  manager: [
    "courses.view",
    "users.view",
    "enrollments.manage",
    "reports.view",
    "reports.export",
    "compliance.view",
  ],
  instructor: [
    "courses.view",
    "courses.create",
    "courses.edit",
    "courses.publish",
    "enrollments.manage",
    "reports.view",
  ],
  learner: ["courses.view"],
};

/** The default permission set for a built-in base role. */
export function defaultPermissionsForRole(role: string | null | undefined): string[] {
  return ROLE_DEFAULT_PERMISSIONS[(role as UserRole)] ?? ROLE_DEFAULT_PERMISSIONS.learner;
}

/**
 * Constrain a requested permission set to what a base role is actually allowed
 * to grant. This is the guard that makes the overlay unable to escalate: the
 * effective grant is the intersection of the requested keys, the base role's
 * defaults, and the known catalog.
 */
export function constrainToBase(baseRole: string, requested: string[]): string[] {
  const allowed = new Set(defaultPermissionsForRole(baseRole));
  const valid = new Set(ALL_PERMISSIONS);
  return requested.filter((k) => allowed.has(k) && valid.has(k));
}

export interface EffectivePermissionSource {
  role: string | null | undefined;
  /** Raw permissions from an assigned custom role, if any. */
  customRolePermissions?: string[] | null;
  /** The custom role's base role, used to re-constrain defensively. */
  customRoleBaseRole?: string | null;
}

/**
 * Resolve a user's effective permission set. When a custom role is assigned,
 * its (base-constrained) permission list wins; otherwise the base role's
 * defaults apply. `super_admin` always gets the full set.
 */
export function resolveEffectivePermissions(src: EffectivePermissionSource): string[] {
  if (src.role === "super_admin") return ALL_PERMISSIONS;
  if (src.customRolePermissions && src.customRoleBaseRole) {
    // Re-constrain at read time as a defense-in-depth measure, in case the
    // stored set drifted from the base role's allowances.
    return constrainToBase(src.customRoleBaseRole, src.customRolePermissions);
  }
  return defaultPermissionsForRole(src.role);
}

/** Pure permission check against an already-resolved permission set. */
export function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

/**
 * Load a user's effective permissions, defensively. Reads the assigned custom
 * role (if any) with the service client. A missing `custom_roles` table/column
 * (e.g. code deployed ahead of the migration) degrades gracefully to the base
 * role's defaults rather than throwing — this keeps it safe to call from the
 * auth-adjacent paths.
 */
export async function loadEffectivePermissions(
  service: SupabaseClient,
  user: { role: string | null; custom_role_id?: string | null }
): Promise<string[]> {
  if (user.role === "super_admin") return ALL_PERMISSIONS;
  if (!user.custom_role_id) return defaultPermissionsForRole(user.role);

  try {
    const { data } = await service
      .from("custom_roles")
      .select("permissions, base_role, is_active")
      .eq("id", user.custom_role_id)
      .maybeSingle();

    if (!data || data.is_active === false) {
      return defaultPermissionsForRole(user.role);
    }
    return resolveEffectivePermissions({
      role: user.role,
      customRolePermissions: (data.permissions as string[]) ?? [],
      customRoleBaseRole: data.base_role as string,
    });
  } catch {
    return defaultPermissionsForRole(user.role);
  }
}

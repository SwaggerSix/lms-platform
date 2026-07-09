import type { UserRole } from "@/types/database";
import { assignableRoles, isSuperAdmin } from "@/lib/auth/roles";

/**
 * "View as" — read-only role preview (§2.12)
 * ------------------------------------------
 * Admins and Super Admins can preview the app as another role to see the
 * navigation, dashboards, and gated features that role gets. The preview is a
 * *read-only lens*: it only changes what the UI renders. State-changing API
 * requests are blocked by the middleware while a preview is active, so an admin
 * can never mutate data while "wearing" another role.
 *
 * The previewed role lives in an HttpOnly cookie. Because `@theme inline` and
 * the rest of the app read the role from `/api/auth/me`, applying the preview
 * server-side there makes the whole client UI reflect it with no per-component
 * wiring. Middleware and the dashboard redirect share the same resolution so
 * navigation stays consistent (and never loops).
 *
 * Keep this file edge-safe (pure functions only) — it is imported by the
 * middleware, which runs on the edge runtime.
 */

/** Cookie holding the currently-previewed role (HttpOnly, set server-side). */
export const VIEW_AS_COOKIE = "lms_view_as";

/** Only client Admins and gC/GGS Super Admins may use "view as". */
export function canUseViewAs(realRole?: string | null): boolean {
  return realRole === "admin" || isSuperAdmin(realRole);
}

/**
 * Roles a given actor may preview. Reuses the assignable-role model — you can
 * preview any role you're allowed to manage — minus your own role (previewing
 * yourself is a no-op). So Admins preview manager/instructor/learner and Super
 * Admins additionally preview admin; neither can preview Super Admin.
 */
export function previewableRoles(realRole?: string | null): UserRole[] {
  if (!canUseViewAs(realRole)) return [];
  return assignableRoles(realRole).filter((r) => r !== realRole);
}

/**
 * Resolve the previewed role from the raw cookie value against the actor's real
 * role. Returns the target role only when the actor may use "view as" and the
 * value is a legitimate, non-self target; otherwise null (preview inactive).
 * A forged cookie from a non-admin resolves to null.
 */
export function resolveViewAsRole(
  realRole: string | null | undefined,
  cookieValue: string | null | undefined
): UserRole | null {
  if (!cookieValue) return null;
  if (!canUseViewAs(realRole)) return null;
  const target = cookieValue as UserRole;
  if (target === realRole) return null;
  return previewableRoles(realRole).includes(target) ? target : null;
}

/**
 * The role the UI should render as: the previewed role when a valid preview is
 * active, otherwise the actor's real role.
 */
export function effectiveRole(
  realRole: string | null | undefined,
  cookieValue: string | null | undefined
): string | null | undefined {
  return resolveViewAsRole(realRole, cookieValue) ?? realRole;
}

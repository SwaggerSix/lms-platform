import { authorize, type Role } from "./authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { loadEffectivePermissions } from "./permissions";

/**
 * Server-only permission enforcement, layered on authorize().
 *
 * This lives in its own module (not permissions.ts) because it imports the
 * service client and authorize(), which must never be pulled into a client
 * bundle. permissions.ts stays client-safe.
 */

/** Resolve the effective granular permissions for an authorized user. */
export async function getEffectivePermissionsForUser(user: {
  id: string;
  role: string;
}): Promise<string[]> {
  if (user.role === "super_admin") {
    // Short-circuit: super_admin holds every permission (and bypasses checks).
    return loadEffectivePermissions(createServiceClient(), {
      role: "super_admin",
      custom_role_id: null,
    });
  }
  const service = createServiceClient();
  const { data } = await service
    .from("users")
    .select("custom_role_id")
    .eq("id", user.id)
    .maybeSingle();
  return loadEffectivePermissions(service, {
    role: user.role,
    custom_role_id: (data as { custom_role_id?: string | null } | null)?.custom_role_id ?? null,
  });
}

/**
 * Like authorize(), but additionally requires a granular permission. The base
 * role gate runs first (unchanged behaviour); then the caller's effective
 * permission set — base-role defaults, narrowed by any custom-role overlay —
 * must include `permissionKey`. Because built-in roles get their full base
 * defaults, this never restricts a built-in role beyond what authorize()
 * already allowed: enforcement only bites for custom (narrowed) roles.
 * super_admin bypasses entirely.
 */
export async function authorizePermission(
  permissionKey: string,
  ...allowedRoles: Role[]
) {
  const auth = await authorize(...allowedRoles);
  if (!auth.authorized) return auth;
  if (auth.user.role === "super_admin") return auth;

  const permissions = await getEffectivePermissionsForUser(auth.user);
  if (!permissions.includes(permissionKey)) {
    return { authorized: false as const, error: "Insufficient permissions", status: 403 };
  }
  return auth;
}

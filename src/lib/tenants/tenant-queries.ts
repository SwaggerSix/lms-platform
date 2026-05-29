import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest } from "next/server";

export interface TenantScope {
  tenantId: string;
  courseIds: string[];
  userIds: string[];
}

/**
 * Resolve the active tenant for a user.
 *
 * - super_admin (gC/GGS staff) is platform-wide: returns null so they see
 *   every tenant, unless they explicitly target one via the x-tenant-id header.
 * - Everyone else — including client "admin" learning leaders — is scoped to
 *   the tenant they belong to (resolved from tenant_memberships). The header is
 *   intentionally NOT trusted for these roles so a scoped user can't read
 *   another organization's data by spoofing it.
 *
 * Returns the resolved tenant ID, or null when no scoping applies.
 */
export async function resolveTenantForUser(
  userId: string,
  userRole: string,
  request?: NextRequest
): Promise<string | null> {
  // Super Admins (gC/GGS) see everything, unless they target a tenant.
  if (userRole === "super_admin") {
    const headerTenantId = request?.headers.get("x-tenant-id");
    return headerTenantId || null;
  }

  // Everyone else (client admins, managers, instructors, learners) is scoped
  // to their own tenant membership.
  const service = createServiceClient();
  const { data } = await service
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  return data?.tenant_id || null;
}

/**
 * Get all course IDs that belong to a tenant.
 * Uses the tenant_courses junction table.
 */
export async function getTenantCourseIds(tenantId: string): Promise<string[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("tenant_courses")
    .select("course_id")
    .eq("tenant_id", tenantId);

  return (data || []).map((r) => r.course_id);
}

/**
 * Get all user IDs that belong to a tenant.
 * Uses the tenant_memberships junction table.
 */
export async function getTenantUserIds(tenantId: string): Promise<string[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId);

  return (data || []).map((r) => r.user_id);
}

/**
 * Full tenant scope: resolves tenant and prefetches course + user IDs.
 * Returns null if no tenant scoping needed (platform-wide super_admin).
 */
export async function getTenantScope(
  userId: string,
  userRole: string,
  request?: NextRequest
): Promise<TenantScope | null> {
  const tenantId = await resolveTenantForUser(userId, userRole, request);
  if (!tenantId) return null;

  const [courseIds, userIds] = await Promise.all([
    getTenantCourseIds(tenantId),
    getTenantUserIds(tenantId),
  ]);

  return { tenantId, courseIds, userIds };
}

/**
 * Check if a feature is enabled for a tenant.
 * Falls back to platform_settings if no tenant or no tenant override.
 */
export async function isFeatureEnabled(
  tenantId: string | null,
  feature: string
): Promise<boolean> {
  const service = createServiceClient();

  // Check tenant-level override first
  if (tenantId) {
    const { data: tenant } = await service
      .from("tenants")
      .select("features")
      .eq("id", tenantId)
      .single();

    const tenantFeatures = tenant?.features as Record<string, boolean> | null;
    if (tenantFeatures && feature in tenantFeatures) {
      return tenantFeatures[feature];
    }
  }

  // Fall back to platform settings
  const { data: settings } = await service
    .from("platform_settings")
    .select("value")
    .eq("key", "features")
    .single();

  const platformFeatures = settings?.value as Record<string, boolean> | null;
  return platformFeatures?.[feature] ?? true;
}

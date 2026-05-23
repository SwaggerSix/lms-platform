import { parseUuid } from "@/lib/validate-uuid";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

/**
 * Server-side cap on the audit_logs row fetch for /admin/audit-log.
 * The client shows a truncation banner when count > AUDIT_LOG_ROW_LIMIT;
 * tighter filters bring the result back under the cap. Co-located
 * with the tenant resolver so the audit-log scope module has one home.
 *
 * Bumping the cap is a deliberate change — the audit-log truncation
 * test imports this constant directly so a change here surfaces in
 * the test bundle without a separate ratchet.
 */
export const AUDIT_LOG_ROW_LIMIT = 500;

interface ResolveAuditLogTenantInput {
  /** Acting user's role. */
  role: string;
  /** Acting user's id (DB) — used for non-admin role tenant scope lookup. */
  userId: string;
  /** Acting user's organization_id (DB) — used as admin default. */
  organizationId: string | null;
  /** Raw x-tenant-id header value. May be null or a malformed string. */
  headerTenantId: string | null;
}

/**
 * Resolve the tenant id the audit-log page should scope its read by.
 *
 *   - Explicit (validated) x-tenant-id header always wins, regardless
 *     of role.
 *   - admin default → user's own organization_id (so a tenant-admin
 *     by-default sees their own tenant's audit rows even without
 *     setting a header).
 *   - super_admin → null (sees everything).
 *   - any other role → falls back to getTenantScope (membership
 *     lookup).
 *   - null when nothing resolves.
 *
 * Extracted from the audit-log page so the resolution rules are
 * testable in isolation and consistent across any future readers
 * (manager view, exports) that need the same scope.
 */
export async function resolveAuditLogTenant(
  input: ResolveAuditLogTenantInput
): Promise<string | null> {
  const headerValid = parseUuid(input.headerTenantId);
  if (headerValid) return headerValid;

  if (input.role === "super_admin") return null;
  if (input.role === "admin") return input.organizationId;

  const scope = await getTenantScope(input.userId, input.role).catch(() => null);
  return scope?.tenantId ?? null;
}

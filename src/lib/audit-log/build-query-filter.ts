/**
 * Given a resolved tenant id (from resolveAuditLogTenant), build the
 * PostgREST .or() filter string for the audit_logs query.
 *
 *   - null tenant: no filter — caller sees all tenants (super_admin without
 *     an explicit header).
 *   - non-null tenant: include rows belonging to that tenant AND
 *     platform-level rows (tenant_id IS NULL) so the scoped admin
 *     still sees system events that affect them.
 *
 * Returning the literal filter string (rather than mutating a query
 * builder) keeps this layer testable without standing up Supabase.
 */
export function buildAuditLogTenantFilter(tenantId: string | null): string | null {
  if (!tenantId) return null;
  return `tenant_id.eq.${tenantId},tenant_id.is.null`;
}

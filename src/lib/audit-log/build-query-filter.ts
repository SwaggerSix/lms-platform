/**
 * Build the PostgREST .or() filter string for any audit / log table
 * scoped on a `tenant_id` column (audit_logs, workflow_step_logs,
 * enrollment_rule_logs, …).
 *
 *   - null tenant: no filter — caller sees all tenants (super_admin
 *     without an explicit header, or a service-role read).
 *   - non-null tenant: include rows belonging to that tenant AND
 *     platform-level rows (tenant_id IS NULL) so a scoped admin still
 *     sees system events that affect them.
 *
 * Returning the literal filter string (rather than mutating a query
 * builder) keeps this layer testable without standing up Supabase.
 *
 * Lives under audit-log/ because that's where the convention
 * originated; consumers across the codebase that scope on tenant_id
 * with the same "include nulls" semantics route through here too
 * (notification-audit, audit-log-namespaces, audit-log page).
 */
export function buildAuditLogTenantFilter(tenantId: string | null): string | null {
  if (!tenantId) return null;
  return `tenant_id.eq.${tenantId},tenant_id.is.null`;
}

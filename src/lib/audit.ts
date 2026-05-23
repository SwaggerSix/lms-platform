import { createServiceClient } from "@/lib/supabase/service";
import { isValidAuditAction } from "@/lib/audit-log/action-convention";
import { isUuid } from "@/lib/validate-uuid";

export interface AuditLogParams {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  /**
   * Optional explicit tenant id. When provided, overrides the
   * audit_logs_set_tenant_id trigger's user→org lookup. Use this for
   * service-role inserts where the acting "user" doesn't carry tenant
   * info but the entity does (e.g. a cron run that operated on rows
   * inside one tenant's scope).
   */
  tenantId?: string;
}

/**
 * Insert an audit log entry. Fire-and-forget — errors are logged but never thrown.
 *
 * Tenant attribution convention:
 *   - Most call sites omit `tenantId` and let the
 *     audit_logs_set_tenant_id DB trigger fill it from the actor's
 *     organization_id. Fine for in-tenant admin actions where the
 *     actor and the entity share a tenant.
 *   - Pass `tenantId` explicitly when the entity belongs to a different
 *     tenant than the actor (super_admin cross-tenant trigger of a
 *     workflow / rule / etc.) so the audit row attributes correctly.
 *     Look up the entity's tenant_id in the same query that fetches it.
 *   - Pass `tenantId` for service-role inserts (cron jobs) where the
 *     "actor" doesn't carry tenant info but the operated-on row does.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  // Runtime guard. The audit-action-conventions test catches static
  // literals at CI time, but actions built from interpolated values
  // can only be validated here. Warn-and-continue rather than throw —
  // a malformed action is worth recording (with a flag) instead of
  // dropping the audit row entirely.
  //
  // Gated to non-production so prod logs don't drown if a dynamic
  // action accidentally proliferates; CI + dev + preview still
  // surface the warning so the regression is caught.
  if (process.env.NODE_ENV !== "production" && !isValidAuditAction(params.action)) {
    console.warn(
      `[audit] non-conformant action "${params.action}" for entity_type ${params.entityType}. Convention: legacy verb or dotted namespace.`
    );
  }
  // Reject a malformed explicit tenantId outright — passing e.g. a
  // column expression instead of a UUID would otherwise hit Postgres
  // and fail the insert (or, worse, succeed with garbage attribution).
  // Treat as if no tenantId was passed so the DB trigger fills it.
  let safeTenantId: string | null = params.tenantId ?? null;
  if (safeTenantId !== null && !isUuid(safeTenantId)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[audit] malformed tenantId "${safeTenantId}" — dropping; falling back to the DB trigger's actor→org lookup.`
      );
    }
    safeTenantId = null;
  }
  try {
    const service = createServiceClient();
    const { error } = await service.from("audit_logs").insert({
      user_id: params.userId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      old_values: params.oldValues ?? null,
      new_values: params.newValues ?? null,
      ip_address: params.ipAddress ?? null,
      tenant_id: safeTenantId,
    });
    if (error) console.error("Audit log failed:", error.message);
  } catch (err) {
    console.error("Audit log network error:", err);
  }
}

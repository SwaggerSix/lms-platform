import { createServiceClient } from "@/lib/supabase/service";
import { isValidAuditAction } from "@/lib/audit-log/action-convention";

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
      tenant_id: params.tenantId ?? null,
    });
    if (error) console.error("Audit log failed:", error.message);
  } catch (err) {
    console.error("Audit log network error:", err);
  }
}

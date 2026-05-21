import { createServiceClient } from "@/lib/supabase/service";

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

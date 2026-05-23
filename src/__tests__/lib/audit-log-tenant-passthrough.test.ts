import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * logAudit accepts an optional tenantId. When provided, it lands in
 * the audit_logs.tenant_id column directly (bypassing the
 * audit_logs_set_tenant_id DB trigger that infers tenant from the
 * actor's organization). When omitted, the column is null and the
 * trigger fills it.
 *
 * Tests assert the wire-level insert payload matches the call shape.
 */

const inserted: Array<Record<string, unknown>> = [];

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

const TENANT_A = "550e8400-e29b-41d4-a716-446655440000";

describe("logAudit tenantId passthrough", () => {
  beforeEach(() => {
    inserted.length = 0;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("forwards tenantId to the insert row when set", async () => {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      action: "workflow.execute",
      entityType: "workflow",
      entityId: "w1",
      tenantId: TENANT_A,
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      action: "workflow.execute",
      entity_type: "workflow",
      entity_id: "w1",
      tenant_id: TENANT_A,
    });
  });

  it("sets tenant_id: null when tenantId is omitted (DB trigger fills it)", async () => {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      action: "created",
      entityType: "course",
      entityId: "c1",
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      action: "created",
      entity_type: "course",
      entity_id: "c1",
      tenant_id: null,
    });
  });

  it("treats explicit tenantId: undefined identically to omission", async () => {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      action: "updated",
      entityType: "course",
      entityId: "c2",
      tenantId: undefined,
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0].tenant_id).toBeNull();
  });

  it("drops a malformed tenantId and falls back to null", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { logAudit } = await import("@/lib/audit");
      await logAudit({
        action: "created",
        entityType: "course",
        entityId: "c1",
        tenantId: "not-a-uuid",
      });
      expect(inserted).toHaveLength(1);
      expect(inserted[0].tenant_id).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      const msg = warnSpy.mock.calls[0]?.[0] as string;
      expect(msg).toContain("not-a-uuid");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("forwards every standard field to the insert payload", async () => {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      userId: "u1",
      action: "rule.execute_manual",
      entityType: "enrollment_rule",
      entityId: "r1",
      oldValues: { run_count: 0 },
      newValues: { run_count: 1 },
      ipAddress: "10.0.0.1",
      tenantId: TENANT_A,
    });
    expect(inserted[0]).toEqual({
      user_id: "u1",
      action: "rule.execute_manual",
      entity_type: "enrollment_rule",
      entity_id: "r1",
      old_values: { run_count: 0 },
      new_values: { run_count: 1 },
      ip_address: "10.0.0.1",
      tenant_id: TENANT_A,
    });
  });
});

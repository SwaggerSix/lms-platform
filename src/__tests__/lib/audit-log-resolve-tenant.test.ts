import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const TENANT_A = "550e8400-e29b-41d4-a716-446655440000";
const TENANT_B = "11111111-2222-3333-4444-555555555555";

// getTenantScope's behavior is what matters for the non-admin paths.
// Stub it to return a deterministic scope so the helper's branching is
// the only thing under test.
vi.mock("@/lib/tenants/tenant-queries", () => ({
  getTenantScope: vi.fn(),
}));

describe("resolveAuditLogTenant", () => {
  let getTenantScopeMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import("@/lib/tenants/tenant-queries");
    getTenantScopeMock = mod.getTenantScope as unknown as ReturnType<typeof vi.fn>;
    getTenantScopeMock.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("explicit valid header wins for super_admin", async () => {
    const { resolveAuditLogTenant } = await import("@/lib/audit-log/resolve-tenant");
    const result = await resolveAuditLogTenant({
      role: "super_admin",
      userId: "u1",
      organizationId: null,
      headerTenantId: TENANT_A,
    });
    expect(result).toBe(TENANT_A);
  });

  it("explicit valid header wins for admin (overrides own-org default)", async () => {
    const { resolveAuditLogTenant } = await import("@/lib/audit-log/resolve-tenant");
    const result = await resolveAuditLogTenant({
      role: "admin",
      userId: "u1",
      organizationId: TENANT_A,
      headerTenantId: TENANT_B,
    });
    expect(result).toBe(TENANT_B);
  });

  it("super_admin without header returns null", async () => {
    const { resolveAuditLogTenant } = await import("@/lib/audit-log/resolve-tenant");
    const result = await resolveAuditLogTenant({
      role: "super_admin",
      userId: "u1",
      organizationId: TENANT_A,
      headerTenantId: null,
    });
    expect(result).toBeNull();
  });

  it("admin without header defaults to own organizationId", async () => {
    const { resolveAuditLogTenant } = await import("@/lib/audit-log/resolve-tenant");
    const result = await resolveAuditLogTenant({
      role: "admin",
      userId: "u1",
      organizationId: TENANT_A,
      headerTenantId: null,
    });
    expect(result).toBe(TENANT_A);
  });

  it("admin with null organizationId and no header returns null", async () => {
    const { resolveAuditLogTenant } = await import("@/lib/audit-log/resolve-tenant");
    const result = await resolveAuditLogTenant({
      role: "admin",
      userId: "u1",
      organizationId: null,
      headerTenantId: null,
    });
    expect(result).toBeNull();
  });

  it("malformed header is ignored — admin still defaults to own org", async () => {
    const { resolveAuditLogTenant } = await import("@/lib/audit-log/resolve-tenant");
    const result = await resolveAuditLogTenant({
      role: "admin",
      userId: "u1",
      organizationId: TENANT_A,
      headerTenantId: "not-a-uuid",
    });
    expect(result).toBe(TENANT_A);
  });

  it("non-admin role calls getTenantScope and returns its tenantId", async () => {
    getTenantScopeMock.mockResolvedValue({ tenantId: TENANT_B, courseIds: [], userIds: [] });
    const { resolveAuditLogTenant } = await import("@/lib/audit-log/resolve-tenant");
    const result = await resolveAuditLogTenant({
      role: "learner",
      userId: "u1",
      organizationId: null,
      headerTenantId: null,
    });
    expect(result).toBe(TENANT_B);
    expect(getTenantScopeMock).toHaveBeenCalledWith("u1", "learner");
  });

  it("non-admin role with null scope returns null", async () => {
    getTenantScopeMock.mockResolvedValue(null);
    const { resolveAuditLogTenant } = await import("@/lib/audit-log/resolve-tenant");
    const result = await resolveAuditLogTenant({
      role: "manager",
      userId: "u1",
      organizationId: null,
      headerTenantId: null,
    });
    expect(result).toBeNull();
  });

  it("non-admin role with getTenantScope throw returns null (catches the error)", async () => {
    getTenantScopeMock.mockRejectedValue(new Error("supabase down"));
    const { resolveAuditLogTenant } = await import("@/lib/audit-log/resolve-tenant");
    const result = await resolveAuditLogTenant({
      role: "manager",
      userId: "u1",
      organizationId: null,
      headerTenantId: null,
    });
    expect(result).toBeNull();
  });

  it("uppercase header is normalized to lowercase", async () => {
    const { resolveAuditLogTenant } = await import("@/lib/audit-log/resolve-tenant");
    const result = await resolveAuditLogTenant({
      role: "admin",
      userId: "u1",
      organizationId: null,
      headerTenantId: TENANT_A.toUpperCase(),
    });
    expect(result).toBe(TENANT_A);
  });
});

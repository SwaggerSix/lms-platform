import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildAuditLogTenantFilter } from "@/lib/audit-log/build-query-filter";

const TENANT_A = "550e8400-e29b-41d4-a716-446655440000";
const TENANT_B = "11111111-2222-3333-4444-555555555555";

vi.mock("@/lib/tenants/tenant-queries", () => ({
  getTenantScope: vi.fn(),
}));

/**
 * Integration test for the audit-log scope chain: resolveAuditLogTenant
 * output → buildAuditLogTenantFilter → final .or() filter that the
 * page applies to the audit_logs query.
 *
 * The unit tests in audit-log-resolve-tenant.test.ts cover each branch
 * of the resolver in isolation. This file pins the end-to-end shape:
 * given a (role, header, organizationId) tuple, the page hits the
 * database with the expected filter string. Regressions in either the
 * resolver or the filter builder will surface here.
 */

describe("audit-log scope chain (resolveAuditLogTenant + buildAuditLogTenantFilter)", () => {
  let getTenantScopeMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import("@/lib/tenants/tenant-queries");
    getTenantScopeMock = mod.getTenantScope as unknown as ReturnType<typeof vi.fn>;
    getTenantScopeMock.mockReset();
  });

  async function resolveToFilter(input: Parameters<typeof import("@/lib/audit-log/resolve-tenant").resolveAuditLogTenant>[0]) {
    const { resolveAuditLogTenant } = await import("@/lib/audit-log/resolve-tenant");
    const tenantId = await resolveAuditLogTenant(input);
    return buildAuditLogTenantFilter(tenantId);
  }

  it("super_admin with no header → null filter (sees every tenant)", async () => {
    const filter = await resolveToFilter({
      role: "super_admin",
      userId: "u1",
      organizationId: null,
      headerTenantId: null,
    });
    expect(filter).toBeNull();
  });

  it("super_admin with explicit header → scoped filter including platform rows", async () => {
    const filter = await resolveToFilter({
      role: "super_admin",
      userId: "u1",
      organizationId: null,
      headerTenantId: TENANT_A,
    });
    expect(filter).toBe(`tenant_id.eq.${TENANT_A},tenant_id.is.null`);
  });

  it("admin without header defaults to own organization, with platform rows", async () => {
    const filter = await resolveToFilter({
      role: "admin",
      userId: "u1",
      organizationId: TENANT_A,
      headerTenantId: null,
    });
    expect(filter).toBe(`tenant_id.eq.${TENANT_A},tenant_id.is.null`);
  });

  it("admin with explicit header overrides own org default", async () => {
    const filter = await resolveToFilter({
      role: "admin",
      userId: "u1",
      organizationId: TENANT_A,
      headerTenantId: TENANT_B,
    });
    expect(filter).toBe(`tenant_id.eq.${TENANT_B},tenant_id.is.null`);
  });

  it("admin with malformed header falls back to own org (not the bad header)", async () => {
    const filter = await resolveToFilter({
      role: "admin",
      userId: "u1",
      organizationId: TENANT_A,
      headerTenantId: "not-a-uuid",
    });
    expect(filter).toBe(`tenant_id.eq.${TENANT_A},tenant_id.is.null`);
  });

  it("admin with no org and no header → null filter (nothing to scope by)", async () => {
    const filter = await resolveToFilter({
      role: "admin",
      userId: "u1",
      organizationId: null,
      headerTenantId: null,
    });
    expect(filter).toBeNull();
  });

  it("non-admin role: getTenantScope tenant becomes the filter", async () => {
    getTenantScopeMock.mockResolvedValue({ tenantId: TENANT_B, courseIds: [], userIds: [] });
    const filter = await resolveToFilter({
      role: "manager",
      userId: "u1",
      organizationId: null,
      headerTenantId: null,
    });
    expect(filter).toBe(`tenant_id.eq.${TENANT_B},tenant_id.is.null`);
  });

  it("uppercase header is normalized before reaching the filter string", async () => {
    const filter = await resolveToFilter({
      role: "admin",
      userId: "u1",
      organizationId: null,
      headerTenantId: TENANT_A.toUpperCase(),
    });
    // Lowercased UUID winds up in the filter — guarantees the .eq()
    // comparison hits the right partition / index.
    expect(filter).toBe(`tenant_id.eq.${TENANT_A},tenant_id.is.null`);
  });
});

describe("buildAuditLogTenantFilter", () => {
  it("null tenant returns null (no filter, super_admin sees all)", () => {
    expect(buildAuditLogTenantFilter(null)).toBeNull();
  });

  it("non-null tenant always includes platform-level rows", () => {
    const filter = buildAuditLogTenantFilter(TENANT_A);
    expect(filter).toContain(`tenant_id.eq.${TENANT_A}`);
    expect(filter).toContain("tenant_id.is.null");
  });
});

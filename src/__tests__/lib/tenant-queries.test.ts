import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * resolveTenantForUser reads the x-tenant-id header and (for non-admin
 * roles) falls back to a tenant_memberships lookup. These tests only
 * exercise the validation + admin-override branches that don't hit
 * the database; the membership branch is left to integration tests.
 */

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: () => ({
            single: () => Promise.resolve({ data: null }),
          }),
        }),
      }),
    }),
  }),
}));

function reqWith(header: string | null): NextRequest {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-tenant-id" ? header : null,
    },
  } as unknown as NextRequest;
}

const VALID = "550e8400-e29b-41d4-a716-446655440000";

describe("resolveTenantForUser — header validation", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("super_admin with no header returns null (sees all tenants)", async () => {
    const { resolveTenantForUser } = await import("@/lib/tenants/tenant-queries");
    const result = await resolveTenantForUser("u1", "super_admin", reqWith(null));
    expect(result).toBeNull();
  });

  it("admin with valid header is honored", async () => {
    const { resolveTenantForUser } = await import("@/lib/tenants/tenant-queries");
    const result = await resolveTenantForUser("u1", "admin", reqWith(VALID));
    expect(result).toBe(VALID);
  });

  it("admin with malformed header is ignored (returns null, logs warning)", async () => {
    const { resolveTenantForUser } = await import("@/lib/tenants/tenant-queries");
    const result = await resolveTenantForUser("u1", "admin", reqWith("not-a-uuid"));
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("admin with uppercase UUID header is honored, lowercased", async () => {
    const { resolveTenantForUser } = await import("@/lib/tenants/tenant-queries");
    const upper = VALID.toUpperCase();
    const result = await resolveTenantForUser("u1", "admin", reqWith(upper));
    expect(result).toBe(VALID);
  });

  it("learner role: malformed header is ignored, falls through to membership lookup", async () => {
    const { resolveTenantForUser } = await import("@/lib/tenants/tenant-queries");
    const result = await resolveTenantForUser("u1", "learner", reqWith("garbage"));
    // membership lookup returns null in the mock → final result is null.
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("learner role: valid header bypasses membership lookup", async () => {
    const { resolveTenantForUser } = await import("@/lib/tenants/tenant-queries");
    const result = await resolveTenantForUser("u1", "learner", reqWith(VALID));
    expect(result).toBe(VALID);
  });

  it("no request object: super_admin/admin → null without crashing", async () => {
    const { resolveTenantForUser } = await import("@/lib/tenants/tenant-queries");
    const result = await resolveTenantForUser("u1", "super_admin");
    expect(result).toBeNull();
  });
});

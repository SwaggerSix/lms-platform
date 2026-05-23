import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * /api/admin/audit-log-namespaces accepts a tenant scope from either
 * the `tenant_id` query string or the `x-tenant-id` header. Query
 * param wins when both are set; malformed header is silently ignored;
 * malformed query param is still 400'd.
 *
 * Tests capture the filter string applied to the Supabase chain so
 * the precedence rules surface as wire-level diffs rather than
 * behavior-only assertions.
 */

const TENANT_A = "550e8400-e29b-41d4-a716-446655440000";
const TENANT_B = "11111111-2222-3333-4444-555555555555";

let capturedOrFilter: string | null = null;
let notNullCalled = false;

vi.mock("@/lib/auth/authorize", () => ({
  authorize: () => Promise.resolve({ authorized: true, user: { id: "u1" } }),
}));

vi.mock("@/lib/supabase/service", () => {
  const chain: {
    select: () => typeof chain;
    order: () => typeof chain;
    limit: () => typeof chain;
    not: () => typeof chain;
    or: (filter: string) => typeof chain;
    then: ((resolve: (v: { data: unknown[]; error: null }) => void) => Promise<unknown>) | undefined;
  } = {
    select: () => chain,
    order: () => chain,
    limit: () => chain,
    not: () => {
      notNullCalled = true;
      return chain;
    },
    or: (filter: string) => {
      capturedOrFilter = filter;
      return chain;
    },
    then: undefined,
  };
  chain.then = (resolve) => Promise.resolve({ data: [], error: null }).then(resolve);
  return {
    createServiceClient: () => ({ from: () => chain }),
  };
});

async function invokeGet(opts: { tenantQuery?: string; tenantHeader?: string; hidePlatform?: boolean } = {}) {
  const { GET } = await import("@/app/api/admin/audit-log-namespaces/route");
  const params = new URLSearchParams();
  if (opts.tenantQuery !== undefined) params.set("tenant_id", opts.tenantQuery);
  if (opts.hidePlatform) params.set("hide_platform", "true");
  const url = `http://test.local/api/admin/audit-log-namespaces${params.size ? "?" + params : ""}`;
  const headers = new Headers();
  if (opts.tenantHeader) headers.set("x-tenant-id", opts.tenantHeader);
  const req = new Request(url, { headers });
  return (GET as unknown as (r: Request) => Promise<Response>)(req);
}

describe("/api/admin/audit-log-namespaces tenant resolution", () => {
  beforeEach(() => {
    capturedOrFilter = null;
    notNullCalled = false;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("no tenant_id query, no header → no .or() filter applied", async () => {
    const res = await invokeGet();
    expect(res.status).toBe(200);
    expect(capturedOrFilter).toBeNull();
  });

  it("tenant_id query alone scopes via .or()", async () => {
    const res = await invokeGet({ tenantQuery: TENANT_A });
    expect(res.status).toBe(200);
    expect(capturedOrFilter).toBe(`tenant_id.eq.${TENANT_A},tenant_id.is.null`);
  });

  it("x-tenant-id header alone scopes via .or()", async () => {
    const res = await invokeGet({ tenantHeader: TENANT_A });
    expect(res.status).toBe(200);
    expect(capturedOrFilter).toBe(`tenant_id.eq.${TENANT_A},tenant_id.is.null`);
  });

  it("query takes precedence when both are set", async () => {
    const res = await invokeGet({ tenantQuery: TENANT_A, tenantHeader: TENANT_B });
    expect(res.status).toBe(200);
    expect(capturedOrFilter).toBe(`tenant_id.eq.${TENANT_A},tenant_id.is.null`);
  });

  it("malformed header is silently ignored (no 400, no filter)", async () => {
    const res = await invokeGet({ tenantHeader: "not-a-uuid" });
    expect(res.status).toBe(200);
    expect(capturedOrFilter).toBeNull();
  });

  it("malformed tenant_id query still 400s", async () => {
    const res = await invokeGet({ tenantQuery: "not-a-uuid" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tenant_id must be a UUID/);
  });

  it("uppercase header is lowercased before being filtered", async () => {
    const res = await invokeGet({ tenantHeader: TENANT_A.toUpperCase() });
    expect(res.status).toBe(200);
    expect(capturedOrFilter).toBe(`tenant_id.eq.${TENANT_A},tenant_id.is.null`);
  });

  it("uppercase query param is lowercased before being filtered", async () => {
    // parseUuid normalizes on the query path now too (used to only
    // normalize on the header path).
    const res = await invokeGet({ tenantQuery: TENANT_A.toUpperCase() });
    expect(res.status).toBe(200);
    expect(capturedOrFilter).toBe(`tenant_id.eq.${TENANT_A},tenant_id.is.null`);
  });

  it("hide_platform=true triggers the .not('tenant_id', 'is', null) branch", async () => {
    const res = await invokeGet({ hidePlatform: true });
    expect(res.status).toBe(200);
    expect(notNullCalled).toBe(true);
  });
});

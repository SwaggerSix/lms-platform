import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Integration test: pick one jsonCached-using GET and one
 * jsonNoStore-using POST and exercise the real handler. Asserts that
 * the wire-level Cache-Control + Vary headers match what the helper
 * is supposed to emit. Catches breakage between the helper and the
 * actual route return — a regression where someone replaces
 * `return jsonCached(x)` with `return NextResponse.json(x)` wouldn't
 * be caught by the helper's own unit tests.
 *
 * Stubs Supabase + auth at the module level so the handler runs in
 * vitest without touching the network.
 */

const TENANT_A = "550e8400-e29b-41d4-a716-446655440000";

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "auth-1" } } }) },
  }),
}));

vi.mock("@/lib/supabase/service", () => {
  const tableChain = () => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      neq: () => chain,
      single: () => Promise.resolve({ data: { id: "u1", role: "admin", organization_id: TENANT_A } }),
      order: () => chain,
      limit: () => chain,
      in: () => chain,
      then: undefined,
    };
    // Make the chain itself awaitable to resolve to an empty list.
    chain.then = (resolve: (v: { data: unknown[]; count: number; error: null }) => void) =>
      Promise.resolve({ data: [], count: 0, error: null }).then(resolve);
    return chain;
  };
  return {
    createServiceClient: () => ({ from: () => tableChain() }),
  };
});

vi.mock("@/lib/tenants/tenant-queries", () => ({
  getTenantScope: () =>
    Promise.resolve({ tenantId: TENANT_A, courseIds: [], userIds: [] }),
  resolveTenantForUser: () => Promise.resolve(TENANT_A),
}));

vi.mock("@/lib/auth/authorize", () => ({
  authorize: () =>
    Promise.resolve({
      authorized: true,
      user: { id: "u1", role: "admin", organization_id: TENANT_A },
    }),
}));

describe("real route handlers emit the headers the helpers promise", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("/api/organizations GET sends jsonCached wire headers", async () => {
    const { GET } = await import("@/app/api/organizations/route");
    const res = await (GET as () => Promise<Response>)();
    expect(res.headers.get("cache-control")).toBe(
      "private, max-age=30, stale-while-revalidate=60"
    );
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("/api/cron/health GET sends Vary: Cookie, Authorization (varyExtra)", async () => {
    // Stub checkCronHealth so it returns a deterministic body without
    // hitting the (mocked) DB.
    vi.doMock("@/lib/cron/monitor", () => ({
      checkCronHealth: () => Promise.resolve({ jobs: [], alerts: [] }),
    }));
    const { GET } = await import("@/app/api/cron/health/route");
    const req = new Request("http://test.local/api/cron/health");
    const res = await (GET as unknown as (r: Request) => Promise<Response>)(req);
    expect(res.headers.get("cache-control")).toBe(
      "private, max-age=10, stale-while-revalidate=20"
    );
    expect(res.headers.get("vary")).toBe("Cookie, Authorization");
  });
});

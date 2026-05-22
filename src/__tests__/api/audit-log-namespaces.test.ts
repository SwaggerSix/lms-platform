import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Snapshot the /api/admin/audit-log-namespaces response shape so any
 * change to the tree structure (depth, parent linkage, sample_capped
 * flag, hide_platform echo) is caught at the route boundary. The
 * service client is mocked at module scope; each test stages a
 * deterministic audit_logs response.
 */

vi.mock("@/lib/auth/authorize", () => ({
  authorize: vi.fn().mockResolvedValue({ authorized: true, user: { id: "test-admin" } }),
}));

const fromMock = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: fromMock }),
}));

function stubQuery(rows: Array<{ action: string; tenant_id: string | null }>) {
  // The route does: from("audit_logs").select(...).order(...).limit(...).
  // hide_platform also chains .not("tenant_id", "is", null) before
  // awaiting. The chain must be then-able at the end.
  const thenable: any = {
    select: () => thenable,
    order: () => thenable,
    limit: () => thenable,
    not: () => thenable,
    then: (resolve: (v: { data: typeof rows; error: null }) => void) =>
      resolve({ data: rows, error: null }),
  };
  fromMock.mockReturnValue(thenable);
}

describe("GET /api/admin/audit-log-namespaces — response shape", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns tree-grouped namespaces with parent linkage + Cache-Control", async () => {
    stubQuery([
      { action: "replay.cron_alerts.compliance-recurrence", tenant_id: "t1" },
      { action: "replay.cron_alerts.compliance-recurrence", tenant_id: "t1" },
      { action: "replay.cron_alerts", tenant_id: null },
      { action: "refresh.notification_audit_view", tenant_id: null },
      { action: "profile.preferences.update", tenant_id: "t1" },
      { action: "profile.preferences.update", tenant_id: "t2" },
      // Legacy single-word actions are filtered out.
      { action: "Created", tenant_id: "t1" },
      { action: "Login", tenant_id: null },
    ]);

    const { GET } = await import("@/app/api/admin/audit-log-namespaces/route");
    const res = await GET(new Request("http://test.local/api/admin/audit-log-namespaces") as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(
      "private, max-age=300, stale-while-revalidate=600"
    );
    const body = await res.json();
    expect(body.hide_platform).toBe(false);
    expect(body.sample_capped).toBe(false);
    expect(body.namespaces).toMatchInlineSnapshot(`
      [
        {
          "count": 3,
          "parent": null,
          "prefix": "replay",
        },
        {
          "count": 2,
          "parent": null,
          "prefix": "profile",
        },
        {
          "count": 1,
          "parent": null,
          "prefix": "refresh",
        },
        {
          "count": 3,
          "parent": "replay",
          "prefix": "replay.cron_alerts",
        },
        {
          "count": 2,
          "parent": "profile",
          "prefix": "profile.preferences",
        },
        {
          "count": 1,
          "parent": "refresh",
          "prefix": "refresh.notification_audit_view",
        },
      ]
    `);
  });

  it("hide_platform=true echoes the flag in the response", async () => {
    stubQuery([{ action: "profile.preferences.update", tenant_id: "t1" }]);
    const { GET } = await import("@/app/api/admin/audit-log-namespaces/route");
    const res = await GET(
      new Request("http://test.local/api/admin/audit-log-namespaces?hide_platform=true") as any
    );
    const body = await res.json();
    expect(body.hide_platform).toBe(true);
  });

  it("sample_capped flips true when the result hits 20k rows", async () => {
    const rows = Array.from({ length: 20000 }, (_, i) => ({
      action: `ns.event-${i}`,
      tenant_id: null,
    }));
    stubQuery(rows);
    const { GET } = await import("@/app/api/admin/audit-log-namespaces/route");
    const res = await GET(new Request("http://test.local/api/admin/audit-log-namespaces") as any);
    const body = await res.json();
    expect(body.sample_capped).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Smoke-tests the /api/cron/health route's cache headers and response
 * shape. checkCronHealth itself hits Supabase, so we mock the monitor
 * module to return a deterministic payload. Same applies to authorize.
 */

vi.mock("@/lib/auth/authorize", () => ({
  authorize: vi.fn().mockResolvedValue({ authorized: true, user: { id: "test-admin" } }),
}));

vi.mock("@/lib/cron/monitor", () => ({
  checkCronHealth: vi.fn(),
}));

describe("GET /api/cron/health — Cache-Control + body shape", () => {
  let healthMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const monitor = await import("@/lib/cron/monitor");
    healthMock = monitor.checkCronHealth as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns Cache-Control with private, max-age=10, stale-while-revalidate=20", async () => {
    healthMock.mockResolvedValue({ jobs: [], alerts: [] });
    const { GET } = await import("@/app/api/cron/health/route");
    const req = new Request("http://test.local/api/cron/health");
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toBe("private, max-age=10, stale-while-revalidate=20");
  });

  it("returns status=healthy when no alerts", async () => {
    healthMock.mockResolvedValue({
      jobs: [{ name: "self-check", last_run: "2026-03-16T12:00:00Z", status: "success" }],
      alerts: [],
    });
    const { GET } = await import("@/app/api/cron/health/route");
    const req = new Request("http://test.local/api/cron/health");
    const res = await GET(req as any);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.alert_count).toBe(0);
    expect(body.jobs).toHaveLength(1);
    expect(typeof body.checked_at).toBe("string");
  });

  it("returns status=degraded when alerts present", async () => {
    healthMock.mockResolvedValue({
      jobs: [],
      alerts: ["job-a [critical]: overdue"],
    });
    const { GET } = await import("@/app/api/cron/health/route");
    const req = new Request("http://test.local/api/cron/health");
    const res = await GET(req as any);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.alert_count).toBe(1);
    expect(body.alerts).toEqual(["job-a [critical]: overdue"]);
  });

  it("returns 500 with error body when checkCronHealth throws", async () => {
    healthMock.mockRejectedValue(new Error("supabase down"));
    const { GET } = await import("@/app/api/cron/health/route");
    const req = new Request("http://test.local/api/cron/health");
    const res = await GET(req as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

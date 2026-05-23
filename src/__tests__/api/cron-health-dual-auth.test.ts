import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * /api/cron/health accepts two auth paths:
 *   1. An authenticated admin session (cookie-based).
 *   2. An Authorization: Bearer <CRON_SECRET> header for automated
 *      monitoring systems.
 *
 * Both paths should return the same JSON body shape. A regression
 * where one path returns extra fields or omits one would silently
 * break external monitors.
 */

vi.mock("@/lib/cron/monitor", () => ({
  checkCronHealth: () =>
    Promise.resolve({
      jobs: [{ name: "j1", lastRun: "2026-05-23T00:00:00.000Z" }],
      alerts: [],
    }),
}));

let authorizeReturn: { authorized: boolean; error?: string; status?: number; user?: { id: string } } = {
  authorized: true,
  user: { id: "u1" },
};

vi.mock("@/lib/auth/authorize", () => ({
  authorize: () => Promise.resolve(authorizeReturn),
}));

async function invokeGet(authHeader: string | null) {
  const { GET } = await import("@/app/api/cron/health/route");
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  const req = new Request("http://test.local/api/cron/health", { headers });
  return (GET as unknown as (r: Request) => Promise<Response>)(req);
}

describe("/api/cron/health dual auth", () => {
  let origSecret: string | undefined;
  beforeEach(() => {
    origSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret-123";
    authorizeReturn = { authorized: true, user: { id: "u1" } };
  });
  afterEach(() => {
    if (origSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = origSecret;
    vi.clearAllMocks();
  });

  it("session-auth path returns 200 with the expected JSON shape", async () => {
    const res = await invokeGet(null);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      status: "healthy",
      checked_at: expect.any(String),
      jobs: [{ name: "j1", lastRun: "2026-05-23T00:00:00.000Z" }],
      alerts: [],
      alert_count: 0,
    });
  });

  it("CRON_SECRET bearer path returns 200 with the same JSON shape", async () => {
    // Force authorize() into a denying state so we know the bearer
    // path was the one that let the request through.
    authorizeReturn = { authorized: false, error: "Unauthorized", status: 401 };
    const res = await invokeGet("Bearer test-secret-123");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.jobs).toHaveLength(1);
    expect(body.alert_count).toBe(0);
  });

  it("session and bearer paths produce identical shapes (same field set)", async () => {
    const sessionRes = await invokeGet(null);
    authorizeReturn = { authorized: false, error: "Unauthorized", status: 401 };
    const bearerRes = await invokeGet("Bearer test-secret-123");
    const sessionBody = await sessionRes.json();
    const bearerBody = await bearerRes.json();
    expect(Object.keys(sessionBody).sort()).toEqual(Object.keys(bearerBody).sort());
  });

  it("wrong bearer + no session → falls through to authorize()'s 401", async () => {
    authorizeReturn = { authorized: false, error: "Unauthorized", status: 401 };
    const res = await invokeGet("Bearer wrong-secret");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("emits cache-control + vary on the success body regardless of auth path", async () => {
    const sessionRes = await invokeGet(null);
    authorizeReturn = { authorized: false, error: "Unauthorized", status: 401 };
    const bearerRes = await invokeGet("Bearer test-secret-123");
    for (const res of [sessionRes, bearerRes]) {
      expect(res.headers.get("cache-control")).toBe(
        "private, max-age=10, stale-while-revalidate=20"
      );
      expect(res.headers.get("vary")).toBe("Cookie, Authorization");
    }
  });
});

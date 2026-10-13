// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The middleware's only outside dependency on these paths is the Supabase
// session lookup; stub it so a test decides whether a user is signed in.
const session = vi.hoisted(() => ({ user: null as null | { id: string }, aal: { currentLevel: "aal1", nextLevel: "aal1" } }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: session.user } }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: session.aal }) },
    },
  }),
}));

import { middleware } from "@/middleware";

function get(path: string, headers: Record<string, string> = {}) {
  return middleware(new NextRequest(`https://learn.example.com${path}`, { headers }));
}

describe("middleware and Vercel Cron", () => {
  beforeEach(() => {
    session.user = null;
    session.aal = { currentLevel: "aal1", nextLevel: "aal1" };
  });

  it("lets a sessionless scheduled run through to the cron route", async () => {
    // A pass-through carries Next's continue header rather than a 401 body.
    const res = await get("/api/cron/gems-sync", { authorization: "Bearer cron-secret" });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes every /api/cron route, leaving the CRON_SECRET check to the route", async () => {
    for (const path of ["/api/cron/sharepoint-roster-sync", "/api/cron/partner-portal-sync", "/api/cron/scheduled-reports"]) {
      const res = await get(path);
      expect(res.headers.get("x-middleware-next"), path).toBe("1");
    }
  });

  it("still answers other sessionless API calls with 401", async () => {
    const res = await get("/api/integrations/gems/catalog");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("doesn't let a cron-looking prefix past the session check", async () => {
    const res = await get("/api/cronjobs");
    expect(res.status).toBe(401);
  });

  it("keeps a signed-in caller on the normal path: no bounce to /dashboard", async () => {
    session.user = { id: "u1" };
    const res = await get("/api/cron/health");
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).not.toBe(401);
  });

  it("keeps the two-factor gate for a signed-in caller", async () => {
    session.user = { id: "u1" };
    session.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    const res = await get("/api/cron/health");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Two-factor verification required" });
  });
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Certificate share links (/verify/<code>) open for anyone: the person handed
// the link has no account. Before this, a signed-out visitor was sent to
// /login, so every shared link led to a sign-in page.
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

const get = (path: string) => middleware(new NextRequest(`https://learn.example.com${path}`));

describe("middleware and certificate share links", () => {
  beforeEach(() => {
    session.user = null;
    session.aal = { currentLevel: "aal1", nextLevel: "aal1" };
  });

  it("opens /verify/<code> for a signed-out visitor", async () => {
    const res = await get("/verify/LMS-ABCD-EFGH-JKLM");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("opens it for a signed-in learner too, without a bounce to the dashboard", async () => {
    session.user = { id: "u1" };
    const res = await get("/verify/LMS-ABCD-EFGH-JKLM");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("leaves the two-factor page and other pages as they were", async () => {
    const twoFactor = await get("/verify-2fa");
    expect(twoFactor.headers.get("location") ?? "").toContain("/login");
    const dash = await get("/dashboard");
    expect(dash.headers.get("location") ?? "").toContain("/login");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Admin → Users → Import: like Add user, each new email account is emailed an
 * invitation with a set-password link unless the admin unticks the box. Only
 * people who weren't emailed get a temporary password back.
 */

let emailFailsFor = new Set<string>();

vi.mock("@/lib/auth/authorize", () => ({
  authorize: async () => ({ authorized: true, user: { id: "admin-1", role: "admin" } }),
}));
vi.mock("@/lib/tenants/tenant-queries", () => ({
  resolveTenantForUser: vi.fn(async () => "t1"),
  isFeatureEnabled: vi.fn(async () => true),
}));

const generateLink = vi.fn(async (opts: { email: string }) => ({
  data: { properties: { action_link: `https://auth.test/recover?for=${opts.email}` } },
  error: null,
}));
function query() {
  const q: Record<string, unknown> = {};
  for (const op of ["select", "eq"]) q[op] = () => q;
  q.maybeSingle = async () => ({ data: { first_name: "Chris", last_name: "C" }, error: null });
  return q;
}
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: () => query(), auth: { admin: { generateLink } } }),
}));

vi.mock("@/lib/users/create-user", () => ({
  createUserAccount: async (_s: unknown, data: Record<string, unknown>) => ({
    ok: true as const,
    user: {
      id: `u-${String(data.email ?? data.login_id)}`,
      email: data.email ?? `${String(data.login_id)}@users.invalid`,
      first_name: data.first_name ?? String(data.login_id),
      login_id: data.login_id ?? null,
    },
    temporaryPassword: `pw-${String(data.email ?? data.login_id)}`,
  }),
}));

const sendEmail = vi.fn(async (m: { to: string; subject: string; html: string }) =>
  emailFailsFor.has(m.to) ? { success: false as const, error: "boom" } : { success: true as const, id: "m" }
);
vi.mock("@/lib/email/sender", () => ({ sendEmail: (m: { to: string; subject: string; html: string }) => sendEmail(m) }));

import { POST } from "@/app/api/users/import/route";

const runImport = (body: Record<string, unknown>) =>
  POST(
    new NextRequest("http://localhost/api/users/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

const row = (email: string) => ({ email, first_name: "A", last_name: "B", role: "learner" });

beforeEach(() => {
  vi.useFakeTimers();
  emailFailsFor = new Set();
  sendEmail.mockClear();
  generateLink.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// The route paces emails with timers; run them out while the request resolves.
async function run(body: Record<string, unknown>) {
  const pending = runImport(body);
  await vi.runAllTimersAsync();
  return (await pending).json();
}

describe("POST /api/users/import invitations", () => {
  it("emails each new person a set-password invitation by default, without handing out passwords", async () => {
    const body = await run({ users: [row("a@example.com"), row("b@example.com")] });
    expect(body).toMatchObject({ total: 2, created: 2, emailed: 2, failed: 0 });
    expect(body.results.every((r: { emailed: boolean }) => r.emailed)).toBe(true);
    expect(body.results.every((r: { temporary_password?: string }) => !r.temporary_password)).toBe(true);
    expect(sendEmail.mock.calls.map(([m]) => m.to).sort()).toEqual(["a@example.com", "b@example.com"]);
    expect(sendEmail.mock.calls[0][0].html).toContain("https://auth.test/recover");
  });

  it("sends nothing when the admin opts out, and returns temporary passwords", async () => {
    const body = await run({ users: [row("a@example.com")], send_invite: false });
    expect(body.emailed).toBe(0);
    expect(body.results[0]).toMatchObject({ emailed: false, temporary_password: "pw-a@example.com" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("retries a failed send once, then returns the link and temporary password", async () => {
    emailFailsFor.add("b@example.com");
    const body = await run({ users: [row("a@example.com"), row("b@example.com")] });
    expect(body.emailed).toBe(1);
    const b = body.results.find((r: { email: string }) => r.email === "b@example.com");
    expect(b).toMatchObject({
      status: "created",
      emailed: false,
      temporary_password: "pw-b@example.com",
      invite_link: "https://auth.test/recover?for=b@example.com",
    });
    // One attempt plus one retry for b; a once.
    expect(sendEmail.mock.calls.filter(([m]) => m.to === "b@example.com")).toHaveLength(2);
  });

  it("never emails user-ID accounts", async () => {
    const body = await run({ users: [{ login_id: "id-001", role: "learner" }] });
    expect(body.results[0]).toMatchObject({ email: "id-001", emailed: false, temporary_password: "pw-id-001" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("caps emailed imports at 200 rows but still allows 500 without invitations", async () => {
    const many = Array.from({ length: 201 }, (_, i) => row(`p${i}@example.com`));
    const capped = await runImport({ users: many });
    expect(capped.status).toBe(400);
    expect((await capped.json()).error).toMatch(/at most 200/);
    expect(sendEmail).not.toHaveBeenCalled();

    const body = await run({ users: many, send_invite: false });
    expect(body.created).toBe(201);
  });
});

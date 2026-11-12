import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Admin → Users → Add user used to create the account and send nothing, so
 * people who were then assigned a path had no way to sign in. Email accounts
 * now get an invitation with a set-password link unless the admin opts out.
 */

let emailOk = true;
let linkOk = true;

vi.mock("@/lib/auth/authorize-permission", () => ({
  authorizePermission: async () => ({ authorized: true, user: { id: "admin-1", role: "admin" } }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/tenants/tenant-queries", () => ({
  getTenantScope: vi.fn(),
  resolveTenantForUser: vi.fn(async () => "t1"),
  isFeatureEnabled: vi.fn(async () => true),
}));

const generateLink = vi.fn(async () =>
  linkOk
    ? { data: { properties: { action_link: "https://auth.test/recover" } }, error: null }
    : { data: null, error: { message: "nope" } }
);
function query() {
  const q: Record<string, unknown> = {};
  for (const op of ["select", "eq"]) q[op] = () => q;
  q.maybeSingle = async () => ({ data: { first_name: "Chris", last_name: "C" }, error: null });
  return q;
}
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: () => query(), auth: { admin: { generateLink } } }),
}));

const createUserAccount = vi.fn(async (_s: unknown, data: Record<string, unknown>) => ({
  ok: true as const,
  user: {
    id: "u1",
    email: data.email ?? "id-1@users.invalid",
    first_name: data.first_name ?? "id-1",
    login_id: data.login_id ?? null,
  },
  temporaryPassword: "temp-pass",
}));
vi.mock("@/lib/users/create-user", () => ({
  createUserAccount: (s: unknown, d: Record<string, unknown>) => createUserAccount(s, d),
}));

const sendEmail = vi.fn(async (_m: { to: string; subject: string; html: string }) =>
  emailOk ? { success: true as const, id: "m" } : { success: false as const, error: "boom" }
);
vi.mock("@/lib/email/sender", () => ({ sendEmail: (m: { to: string; subject: string; html: string }) => sendEmail(m) }));

import { POST } from "@/app/api/users/route";

const add = (body: Record<string, unknown>) =>
  POST(
    new NextRequest("http://localhost/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

const person = { email: "pat@example.com", first_name: "Pat", last_name: "Lee", role: "learner" };

beforeEach(() => {
  emailOk = true;
  linkOk = true;
  sendEmail.mockClear();
  generateLink.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/users (Add user)", () => {
  it("emails a set-password invitation by default", async () => {
    const res = await add(person);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.invite_emailed).toBe(true);
    // They set their own password, so the temporary one isn't handed out.
    expect(body.temporary_password).toBeUndefined();
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: "recovery", email: "pat@example.com" }));
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("pat@example.com");
    expect(sendEmail.mock.calls[0][0].html).toContain("https://auth.test/recover");
  });

  it("sends nothing when the admin opts out, and returns the temporary password", async () => {
    const body = await (await add({ ...person, send_invite: false })).json();
    expect(body.invite_emailed).toBe(false);
    expect(body.temporary_password).toBe("temp-pass");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns the link and temporary password when the email fails", async () => {
    emailOk = false;
    const body = await (await add(person)).json();
    expect(body.invite_emailed).toBe(false);
    expect(body.invite_link).toBe("https://auth.test/recover");
    expect(body.temporary_password).toBe("temp-pass");
  });

  it("never emails a user-ID account (no inbox)", async () => {
    const body = await (await add({ login_id: "id-1", role: "learner" })).json();
    expect(body.temporary_password).toBe("temp-pass");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
  });
});

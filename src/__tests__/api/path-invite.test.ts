import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Admin → Learning Paths → Invite people: existing accounts get the path and
 * its courses plus an email; new addresses get an account (createUserAccount
 * + set-password link) first. Idempotent, admin/manager only, managers only
 * for their own team and never creating accounts.
 */

const PATH = "22222222-2222-4222-8222-222222222222";
const ADMIN = "admin-1";
const MANAGER = "manager-1";

let actor: { id: string; role: string } | null;
let users: { id: string; email: string; first_name: string; status: string; manager_id: string | null; login_id: null; auth_id: string }[];
// Auth ids of accounts that have signed in at least once.
let signedIn: Set<string>;
let pathEnrollments: Set<string>;
let courseEnrollments: Set<string>;
let pathStatus = "published";
let rateOk = true;

type Op = { op: string; args: unknown[] };

function resolve(table: string, ops: Op[]): { data: unknown; error: unknown } {
  const arg = (op: string, i = 0) => ops.find((o) => o.op === op)?.args[i];
  const eqs = ops.filter((o) => o.op === "eq").map((o) => o.args as [string, unknown]);
  const eqv = (col: string) => eqs.find(([c]) => c === col)?.[1];
  if (table === "learning_paths") {
    return { data: { id: PATH, title: "Mosaic Certification", slug: "mosaic-certification", status: pathStatus }, error: null };
  }
  if (table === "learning_path_items") {
    return { data: [{ course_id: "c1", sequence_order: 1 }, { course_id: "c2", sequence_order: 2 }], error: null };
  }
  if (table === "users") {
    if (arg("ilike")) {
      const email = String(arg("ilike", 1)).toLowerCase();
      return { data: users.find((u) => u.email.toLowerCase() === email) ?? null, error: null };
    }
    return { data: { first_name: "Chris", last_name: "C" }, error: null };
  }
  if (table === "learning_path_enrollments") {
    const upsert = arg("upsert") as { user_id: string; path_id: string } | undefined;
    if (upsert) {
      pathEnrollments.add(`${upsert.user_id}:${upsert.path_id}`);
      return { data: null, error: null };
    }
    const key = `${eqv("user_id")}:${eqv("path_id")}`;
    return { data: pathEnrollments.has(key) ? { id: "pe" } : null, error: null };
  }
  if (table === "enrollments") {
    const rows = (arg("upsert") as { user_id: string; course_id: string }[]) || [];
    for (const r of rows) courseEnrollments.add(`${r.user_id}:${r.course_id}`);
    return { data: null, error: null };
  }
  return { data: null, error: null };
}

function query(table: string) {
  const ops: Op[] = [];
  const q: Record<string, unknown> = {};
  for (const op of ["select", "eq", "ilike", "in", "order", "limit", "update", "insert", "upsert"]) {
    q[op] = (...args: unknown[]) => {
      ops.push({ op, args });
      return q;
    };
  }
  for (const op of ["single", "maybeSingle"]) q[op] = async () => resolve(table, ops);
  q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(resolve(table, ops)).then(res, rej);
  return q;
}

const generateLink = vi.fn(async () => ({ data: { properties: { action_link: "https://auth.test/recover" } }, error: null }));
const getUserById = vi.fn(async (authId: string) => ({
  data: { user: { id: authId, last_sign_in_at: signedIn.has(authId) ? "2026-11-01T00:00:00Z" : null } },
  error: null,
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (t: string) => query(t), auth: { admin: { generateLink, getUserById } } }),
}));
vi.mock("@/lib/auth/authorize", () => ({
  authorize: async (...roles: string[]) => {
    if (!actor) return { authorized: false, error: "Not authenticated", status: 401 };
    if (actor.role !== "super_admin" && !roles.includes(actor.role)) {
      return { authorized: false, error: "Insufficient permissions", status: 403 };
    }
    return { authorized: true, user: { ...actor, organization_id: null } };
  },
}));
vi.mock("@/lib/auth/authorize-permission", () => ({
  getEffectivePermissionsForUser: async () => ["users.manage"],
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: rateOk }) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/services/course-materials", () => ({ provisionCourseMaterials: vi.fn(async () => {}) }));
const sendEmail = vi.fn(async (_m: { to: string; subject: string; html: string }) => ({ success: true }));
vi.mock("@/lib/email/sender", () => ({ sendEmail: (m: { to: string; subject: string; html: string }) => sendEmail(m) }));
const createUserAccount = vi.fn(async (_s: unknown, data: Record<string, unknown>) => {
  const id = `u-${String(data.email)}`;
  const user = { id, email: String(data.email), first_name: String(data.first_name), status: "active", manager_id: null, login_id: null, auth_id: `a-${id}` };
  users.push(user);
  return { ok: true as const, user, temporaryPassword: "x" };
});
vi.mock("@/lib/users/create-user", () => ({
  createUserAccount: (s: unknown, d: Record<string, unknown>) => createUserAccount(s, d),
}));

import { POST } from "@/app/api/paths/[id]/invite/route";

function invite(text: string) {
  return POST(
    new NextRequest(`http://localhost/api/paths/${PATH}/invite`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }),
    { params: Promise.resolve({ id: PATH }) }
  );
}

beforeEach(() => {
  actor = { id: ADMIN, role: "admin" };
  users = [
    { id: "u-existing", email: "Existing@Example.com", first_name: "Eve", status: "active", manager_id: null, login_id: null, auth_id: "a-u-existing" },
    { id: "u-report", email: "report@example.com", first_name: "Rae", status: "active", manager_id: MANAGER, login_id: null, auth_id: "a-u-report" },
  ];
  signedIn = new Set(["a-u-existing", "a-u-report"]);
  pathEnrollments = new Set();
  courseEnrollments = new Set();
  pathStatus = "published";
  rateOk = true;
  sendEmail.mockClear();
  createUserAccount.mockClear();
  generateLink.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/paths/[id]/invite", () => {
  it("enrolls existing accounts, creates and invites new ones, and emails both", async () => {
    const res = await invite("existing@example.com\nNew Person <new@example.com>");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toEqual({ invited: 1, added: 1, resent: 0, already: 0, failed: 0 });

    // Path plus every course on it, for both people.
    for (const id of ["u-existing", "u-new@example.com"]) {
      expect(pathEnrollments.has(`${id}:${PATH}`)).toBe(true);
      expect(courseEnrollments.has(`${id}:c1`)).toBe(true);
      expect(courseEnrollments.has(`${id}:c2`)).toBe(true);
    }

    // New account made the Admin → Users way, then the set-password link.
    expect(createUserAccount).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: "new@example.com", first_name: "New", last_name: "Person", role: "learner" })
    );
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: "recovery", email: "new@example.com" }));

    const toNew = sendEmail.mock.calls.find(([m]) => m.to === "new@example.com")![0];
    expect(toNew.html).toContain("https://auth.test/recover");
    expect(toNew.subject).toContain("Mosaic Certification");
    const toExisting = sendEmail.mock.calls.find(([m]) => m.to === "Existing@Example.com")![0];
    expect(toExisting.html).toContain("/learn/paths/mosaic-certification");
  });

  it("is idempotent: a second run reports already-had-access and emails no one who has signed in", async () => {
    await invite("existing@example.com, new@example.com");
    signedIn.add("a-u-new@example.com");
    sendEmail.mockClear();
    createUserAccount.mockClear();
    const res = await invite("existing@example.com, new@example.com");
    const body = await res.json();
    expect(body.summary).toEqual({ invited: 0, added: 0, resent: 0, already: 2, failed: 0 });
    expect(createUserAccount).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("re-sends a set-password link to someone who already had the path but never signed in", async () => {
    await invite("new@example.com");
    sendEmail.mockClear();
    generateLink.mockClear();
    const body = await (await invite("new@example.com")).json();
    expect(body.summary).toEqual({ invited: 0, added: 0, resent: 1, already: 0, failed: 0 });
    expect(body.results[0].status).toBe("resent");
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: "recovery", email: "new@example.com" }));
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].html).toContain("https://auth.test/recover");
  });

  it("reports a failed re-send as failed, not as already-had-access", async () => {
    await invite("new@example.com");
    sendEmail.mockResolvedValueOnce({ success: false } as never);
    const body = await (await invite("new@example.com")).json();
    expect(body.summary).toEqual({ invited: 0, added: 0, resent: 0, already: 0, failed: 1 });
    expect(body.results[0].reason).toMatch(/Resend invite/);
  });

  it("sends an existing account that never signed in a set-password link, not just the path", async () => {
    signedIn.delete("a-u-existing");
    const body = await (await invite("existing@example.com")).json();
    expect(body.summary).toEqual({ invited: 0, added: 1, resent: 0, already: 0, failed: 0 });
    const mail = sendEmail.mock.calls.find(([m]) => m.to === "Existing@Example.com")![0];
    expect(mail.html).toContain("https://auth.test/recover");
    expect(mail.html).toContain("Set your password");
  });

  it("reports lines without an address as failed", async () => {
    const body = await (await invite("existing@example.com\nnonsense")).json();
    expect(body.summary).toMatchObject({ added: 1, failed: 1 });
  });

  it("refuses learners and instructors", async () => {
    actor = { id: "learner-1", role: "learner" };
    expect((await invite("existing@example.com")).status).toBe(403);
    actor = { id: "inst-1", role: "instructor" };
    expect((await invite("existing@example.com")).status).toBe(403);
    actor = null;
    expect((await invite("existing@example.com")).status).toBe(401);
    expect(pathEnrollments.size).toBe(0);
  });

  it("lets a manager invite only their own team, and never create accounts", async () => {
    actor = { id: MANAGER, role: "manager" };
    const body = await (await invite("report@example.com, existing@example.com, brand-new@example.com")).json();
    expect(body.summary).toEqual({ invited: 0, added: 1, resent: 0, already: 0, failed: 2 });
    expect(pathEnrollments.has(`u-report:${PATH}`)).toBe(true);
    expect(pathEnrollments.has(`u-existing:${PATH}`)).toBe(false);
    expect(createUserAccount).not.toHaveBeenCalled();
  });

  it("caps the batch at 200 addresses", async () => {
    const many = Array.from({ length: 201 }, (_, i) => `p${i}@example.com`).join("\n");
    const res = await invite(many);
    expect(res.status).toBe(400);
    expect(createUserAccount).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    rateOk = false;
    expect((await invite("existing@example.com")).status).toBe(429);
  });

  it("refuses an unpublished path", async () => {
    pathStatus = "draft";
    expect((await invite("existing@example.com")).status).toBe(400);
  });
});

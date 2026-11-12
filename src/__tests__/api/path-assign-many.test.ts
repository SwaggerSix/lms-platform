import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Admin → Learning Paths → Assign sends user_ids. The route used to ignore
 * them and enroll the admin instead; it now enrolls the people picked, and
 * emails them — with a set-password link if they have never signed in.
 */

const PATH = "22222222-2222-4222-8222-222222222222";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let profile = { id: "admin-1", role: "admin" };
let pathEnrollments: Set<string>;
type Op = { op: string; args: unknown[] };

function resolve(table: string, ops: Op[]) {
  const arg = (op: string) => ops.find((o) => o.op === op)?.args[0];
  const eqv = (c: string) => ops.find((o) => o.op === "eq" && o.args[0] === c)?.args[1];
  if (table === "users") {
    if (ops.some((o) => o.op === "in")) {
      return {
        data: [
          { id: A, manager_id: "manager-1", email: "a@example.com", first_name: "Ann", auth_id: "auth-a", login_id: null },
          { id: B, manager_id: null, email: "b@example.com", first_name: "Ben", auth_id: "auth-b", login_id: null },
        ],
        error: null,
      };
    }
    return { data: profile, error: null };
  }
  if (table === "learning_paths") return { data: { id: PATH, title: "Mosaic Certification" }, error: null };
  if (table === "learning_path_items") return { data: [{ course_id: "c1" }], error: null };
  if (table === "learning_path_enrollments") {
    const up = arg("upsert") as { user_id: string } | undefined;
    if (up) {
      pathEnrollments.add(up.user_id);
      return { data: null, error: null };
    }
    return { data: pathEnrollments.has(String(eqv("user_id"))) ? { id: "x" } : null, error: null };
  }
  return { data: null, error: null };
}

function query(table: string) {
  const ops: Op[] = [];
  const q: Record<string, unknown> = {};
  for (const op of ["select", "eq", "in", "order", "update", "insert", "upsert"]) {
    q[op] = (...args: unknown[]) => {
      ops.push({ op, args });
      return q;
    };
  }
  for (const op of ["single", "maybeSingle"]) q[op] = async () => resolve(table, ops);
  q.then = (res: (v: unknown) => unknown) => Promise.resolve(resolve(table, ops)).then(res);
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "auth-1" } } }) } }),
}));
// auth-a has signed in before; auth-b never has (added without an invite).
const getUserById = vi.fn(async (id: string) => ({
  data: { user: { id, last_sign_in_at: id === "auth-a" ? "2026-11-01T00:00:00Z" : null } },
  error: null,
}));
const generateLink = vi.fn(async () => ({ data: { properties: { action_link: "https://auth.test/recover" } }, error: null }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (t: string) => query(t), auth: { admin: { getUserById, generateLink } } }),
}));
let emailOk = true;
const sendEmail = vi.fn(async (_m: { to: string; subject: string; html: string }) =>
  emailOk ? { success: true as const, id: "m" } : { success: false as const, error: "boom" }
);
vi.mock("@/lib/email/sender", () => ({ sendEmail: (m: { to: string; subject: string; html: string }) => sendEmail(m) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/services/course-materials", () => ({ provisionCourseMaterials: vi.fn(async () => {}) }));

import { POST } from "@/app/api/paths/enroll/route";

const assign = (user_ids: string[]) =>
  POST(
    new NextRequest("http://localhost/api/paths/enroll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path_id: PATH, user_ids }),
    })
  );

beforeEach(() => {
  profile = { id: "admin-1", role: "admin" };
  pathEnrollments = new Set();
  emailOk = true;
  sendEmail.mockClear();
  generateLink.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/paths/enroll with user_ids", () => {
  it("enrolls the people picked, not the admin", async () => {
    const res = await assign([A, B]);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ enrolled_count: 2, skipped: 0 });
    expect([...pathEnrollments].sort()).toEqual([A, B]);
  });

  it("emails each person assigned, with a set-password link for anyone who never signed in", async () => {
    const body = await (await assign([A, B])).json();
    expect(body.emails).toEqual({ emailed: 1, setup: 1, failed: 0, no_inbox: 0 });

    const toA = sendEmail.mock.calls.find(([m]) => m.to === "a@example.com")![0];
    expect(toA.html).toContain("/learn/paths");
    expect(toA.html).not.toContain("https://auth.test/recover");

    const toB = sendEmail.mock.calls.find(([m]) => m.to === "b@example.com")![0];
    expect(toB.html).toContain("https://auth.test/recover");
    expect(generateLink).toHaveBeenCalledTimes(1);
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: "recovery", email: "b@example.com" }));
  });

  it("doesn't email people who already had the path", async () => {
    await assign([A]);
    sendEmail.mockClear();
    const body = await (await assign([A])).json();
    expect(body).toMatchObject({ enrolled_count: 0, skipped: 1 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("reports who wasn't emailed when sending fails, but still enrolls them", async () => {
    emailOk = false;
    const body = await (await assign([A, B])).json();
    expect(body.enrolled_count).toBe(2);
    expect(body.emails.failed).toBe(2);
    expect(body.not_emailed.sort()).toEqual(["a@example.com", "b@example.com"]);
  });

  it("a manager only assigns their own reports", async () => {
    profile = { id: "manager-1", role: "manager" };
    const body = await (await assign([A, B])).json();
    expect(body).toMatchObject({ enrolled_count: 1, skipped: 1 });
    expect([...pathEnrollments]).toEqual([A]);
  });

  it("learners can't assign", async () => {
    profile = { id: "learner-1", role: "learner" };
    expect((await assign([A])).status).toBe(403);
  });
});

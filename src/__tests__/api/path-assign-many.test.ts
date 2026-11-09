import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Admin → Learning Paths → Assign sends user_ids. The route used to ignore
 * them and enroll the admin instead; it now enrolls the people picked.
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
      return { data: [{ id: A, manager_id: "manager-1" }, { id: B, manager_id: null }], error: null };
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
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: (t: string) => query(t) }) }));
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
});

describe("POST /api/paths/enroll with user_ids", () => {
  it("enrolls the people picked, not the admin", async () => {
    const res = await assign([A, B]);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ enrolled_count: 2, skipped: 0 });
    expect([...pathEnrollments].sort()).toEqual([A, B]);
  });

  it("a manager only assigns their own reports", async () => {
    profile = { id: "manager-1", role: "manager" };
    const body = await (await assign([A, B])).json();
    expect(body).toEqual({ enrolled_count: 1, skipped: 1 });
    expect([...pathEnrollments]).toEqual([A]);
  });

  it("learners can't assign", async () => {
    profile = { id: "learner-1", role: "learner" };
    expect((await assign([A])).status).toBe(403);
  });
});

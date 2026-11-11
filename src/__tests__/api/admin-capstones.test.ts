import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Marking a capstone (PATCH /api/admin/capstones/[id]): Pass issues the
 * certificate and tells the portal; "Not yet" returns feedback with one
 * resubmission, and on the last allowed attempt says a call comes next;
 * a submission can only be marked once.
 */

const SUB = "11111111-1111-4111-8111-111111111111";
const CERT = "22222222-2222-4222-8222-222222222222";
const LEARNER = "33333333-3333-4333-8333-333333333333";

type Row = Record<string, unknown>;
let submission: Row;
let issued: Row[];
let emails: { to: string; subject: string; text?: string }[];
let portalCalls: string[];
let role = "admin";
type Op = { op: string; args: unknown[] };

function resolve(table: string, ops: Op[]) {
  const has = (op: string) => ops.some((o) => o.op === op);
  const arg = (op: string) => ops.find((o) => o.op === op)?.args[0];
  const eqs = ops.filter((o) => o.op === "eq").map((o) => o.args as [string, unknown]);
  if (table === "capstone_submissions") {
    if (has("update")) {
      const patch = arg("update") as Row;
      const needStatus = eqs.find(([c]) => c === "status")?.[1];
      if (needStatus !== undefined && submission.status !== needStatus) return { data: null, error: null };
      Object.assign(submission, patch);
      return { data: { id: SUB }, error: null };
    }
    if (has("order")) return { data: { id: SUB }, error: null }; // latest attempt
    return { data: { ...submission }, error: null };
  }
  if (table === "certifications") {
    return {
      data: {
        id: CERT, name: "Mosaic Practitioner", description: null, learning_path_id: "p", requires_capstone: true,
        capstone_instructions: null, max_capstone_attempts: 2, validity_months: 60, portal_certification: "mosaic-practitioner",
      },
      error: null,
    };
  }
  if (table === "users") return { data: { email: "sam@example.com", first_name: "Sam" }, error: null };
  if (table === "user_certifications") {
    if (has("insert")) {
      const row = { id: `uc-${issued.length + 1}`, ...(arg("insert") as Row) };
      issued.push(row);
      return { data: row, error: null };
    }
    return { data: null, error: null }; // no verification-code clash
  }
  return { data: null, error: null };
}

function query(table: string) {
  const ops: Op[] = [];
  const q: Record<string, unknown> = {};
  for (const op of ["select", "eq", "in", "neq", "order", "limit", "update", "insert", "upsert"]) {
    q[op] = (...args: unknown[]) => {
      ops.push({ op, args });
      return q;
    };
  }
  for (const op of ["single", "maybeSingle"]) q[op] = async () => resolve(table, ops);
  q.then = (res: (v: unknown) => unknown) => Promise.resolve(resolve(table, ops)).then(res);
  return q;
}

vi.mock("@/lib/auth/authorize", () => ({
  authorize: async () =>
    role === "admin"
      ? { authorized: true, user: { id: "admin-1", role: "admin", organization_id: null } }
      : { authorized: false, error: "Insufficient permissions", status: 403 },
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: (t: string) => query(t) }) }));
vi.mock("@/lib/email/sender", () => ({
  sendEmail: vi.fn(async (m: { to: string; subject: string; text?: string }) => {
    emails.push(m);
    return { success: true, id: "e" };
  }),
}));
vi.mock("@/lib/capstones/portal", () => ({
  syncCertificationToPortal: vi.fn(async (_s: unknown, id: string) => {
    portalCalls.push(id);
    return { status: "awarded", at: "now", invited: true };
  }),
}));

import { PATCH } from "@/app/api/admin/capstones/[id]/route";

const mark = (body: unknown) =>
  PATCH(
    new NextRequest(`http://localhost/api/admin/capstones/${SUB}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: SUB }) }
  );

const FEEDBACK = "Your memo treats the 88th percentile as a score. Rework finding 1 and the confidence section.";

beforeEach(() => {
  role = "admin";
  issued = [];
  emails = [];
  portalCalls = [];
  submission = {
    id: SUB, certification_id: CERT, user_id: LEARNER, attempt: 1, status: "submitted",
    another_attempt_allowed: false, user_certification_id: null,
  };
});

describe("PATCH /api/admin/capstones/[id]", () => {
  it("is admin-only", async () => {
    role = "learner";
    expect((await mark({ action: "pass" })).status).toBe(403);
    expect(issued).toHaveLength(0);
  });

  it("Pass issues a five-year certificate, emails the learner and tells the portal", async () => {
    const res = await mark({ action: "pass" });
    expect(res.status).toBe(200);
    expect(submission.status).toBe("passed");
    expect(issued).toHaveLength(1);
    const cert = issued[0];
    expect(cert.user_id).toBe(LEARNER);
    expect(cert.status).toBe("active");
    expect(String(cert.verification_code)).toMatch(/^LMS-/);
    const years = (Date.parse(String(cert.expires_at)) - Date.parse(String(cert.issued_at))) / (365.25 * 864e5);
    expect(Math.round(years)).toBe(5);
    expect(submission.user_certification_id).toBe(cert.id);
    expect(emails.map((e) => e.subject)).toEqual(["You're certified: Mosaic Practitioner"]);
    expect(portalCalls).toEqual([cert.id]);
  });

  it("Not yet on attempt 1 sends the feedback and offers one resubmission", async () => {
    const res = await mark({ action: "not_yet", feedback: FEEDBACK });
    expect(res.status).toBe(200);
    expect((await res.json()).needs_call).toBe(false);
    expect(submission.status).toBe("not_yet");
    expect(submission.feedback).toBe(FEEDBACK);
    expect(emails).toHaveLength(1);
    expect(emails[0].text).toContain(FEEDBACK);
    expect(emails[0].text).toContain("one resubmission");
    expect(issued).toHaveLength(0);
  });

  it("Not yet on attempt 2 says a call comes next", async () => {
    submission.attempt = 2;
    const res = await mark({ action: "not_yet", feedback: FEEDBACK });
    expect((await res.json()).needs_call).toBe(true);
    expect(emails[0].subject).toContain("set up a call");
  });

  it("Not yet needs real feedback", async () => {
    expect((await mark({ action: "not_yet", feedback: "no" })).status).toBe(400);
    expect(submission.status).toBe("submitted");
  });

  it("can't mark the same submission twice", async () => {
    expect((await mark({ action: "pass" })).status).toBe(200);
    expect((await mark({ action: "pass" })).status).toBe(409);
    expect(issued).toHaveLength(1);
  });

  it("after the call, allows exactly one more attempt", async () => {
    submission.attempt = 2;
    submission.status = "not_yet";
    expect((await mark({ action: "allow_attempt" })).status).toBe(200);
    expect(submission.another_attempt_allowed).toBe(true);
    expect(emails[0].subject).toContain("submit your capstone again");
    expect((await mark({ action: "allow_attempt" })).status).toBe(409);
  });

  it("won't reopen an attempt that still has a resubmission left", async () => {
    submission.status = "not_yet";
    expect((await mark({ action: "allow_attempt" })).status).toBe(409);
  });
});

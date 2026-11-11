import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const CERT = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const PREFIX = `${USER}/${CERT}/`;

let state: { kind: string; nextAttempt?: number };
let stored: string[];
let inserted: Record<string, unknown>[];
let emails: string[];

function query(table: string) {
  const ops: { op: string; args: unknown[] }[] = [];
  const q: Record<string, unknown> = {};
  for (const op of ["select", "eq", "insert"]) {
    q[op] = (...args: unknown[]) => {
      ops.push({ op, args });
      return q;
    };
  }
  const resolve = async () => {
    const ins = ops.find((o) => o.op === "insert");
    if (table === "capstone_submissions" && ins) {
      inserted.push(ins.args[0] as Record<string, unknown>);
      return { data: { id: "s1", attempt: (ins.args[0] as { attempt: number }).attempt, submitted_at: "2026-11-11T12:00:00Z" }, error: null };
    }
    if (table === "users") return { data: { email: "sam@example.com", first_name: "Sam", last_name: "Lee" }, error: null };
    return { data: null, error: null };
  };
  q.single = resolve;
  q.maybeSingle = resolve;
  return q;
}

const service = {
  from: (t: string) => query(t),
  storage: {
    from: () => ({
      list: async () => ({ data: stored.map((name) => ({ name, metadata: { size: 1234 } })), error: null }),
    }),
  },
};

vi.mock("@/lib/capstones/context", () => ({
  learnerCapstoneContext: async () => ({
    ok: true,
    userId: USER,
    service,
    certification: { id: CERT, name: "Mosaic Practitioner", max_capstone_attempts: 2 },
    attempts: [],
    progress: { complete: true, total: 5, done: 5 },
    state,
  }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }) }));
vi.mock("@/lib/email/sender", () => ({
  sendEmail: vi.fn(async (m: { subject: string }) => {
    emails.push(m.subject);
    return { success: true, id: "e" };
  }),
}));

import { POST } from "@/app/api/capstones/[certificationId]/submissions/route";

const submit = (body: unknown) =>
  POST(
    new NextRequest(`http://localhost/api/capstones/${CERT}/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ certificationId: CERT }) }
  );

beforeEach(() => {
  state = { kind: "open", nextAttempt: 1 };
  stored = ["abc-memo.pdf"];
  inserted = [];
  emails = [];
  process.env.CAPSTONE_ASSESSOR_EMAIL = "assessor@example.com";
});

describe("POST /api/capstones/[certificationId]/submissions", () => {
  it("submits own uploaded files and https links as the next attempt", async () => {
    const res = await submit({
      files: [{ path: `${PREFIX}abc-memo.pdf`, name: "memo.pdf" }],
      links: [{ label: "Briefing", url: "https://www.loom.com/share/x" }],
    });
    expect(res.status).toBe(201);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ attempt: 1, status: "submitted", user_id: USER, certification_id: CERT });
    expect((inserted[0].files as { size: number }[])[0].size).toBe(1234);
    // receipt to the learner, "ready to mark" to the assessor
    expect(emails).toEqual(["Capstone received: Mosaic Practitioner", "Capstone to mark: Sam Lee (attempt 1)"]);
  });

  it("refuses while not open (e.g. one is already being marked)", async () => {
    state = { kind: "waiting" };
    expect((await submit({ links: [{ label: "x", url: "https://a.b/c" }] })).status).toBe(409);
    expect(inserted).toHaveLength(0);
  });

  it("refuses someone else's file", async () => {
    const res = await submit({ files: [{ path: `99999999-9999-4999-8999-999999999999/${CERT}/abc-memo.pdf`, name: "m.pdf" }] });
    expect(res.status).toBe(400);
    expect(inserted).toHaveLength(0);
  });

  it("refuses a file that never finished uploading", async () => {
    stored = [];
    const res = await submit({ files: [{ path: `${PREFIX}abc-memo.pdf`, name: "memo.pdf" }] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("didn't finish uploading");
  });

  it("refuses non-https links and empty submissions", async () => {
    expect((await submit({ links: [{ label: "x", url: "http://a.b/c" }] })).status).toBe(400);
    expect((await submit({})).status).toBe(400);
    expect(inserted).toHaveLength(0);
  });
});

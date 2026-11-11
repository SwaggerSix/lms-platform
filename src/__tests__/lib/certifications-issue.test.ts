import { describe, it, expect, beforeEach } from "vitest";
import {
  expiryFor,
  issueCourseCompletionCertificates,
  awardCertification,
  revokeCertification,
} from "@/lib/certifications/issue";

/**
 * Finishing a course issues its completion certificate; it never issues a
 * staff-awarded credential (Mosaic Certified), which needs the assessor to
 * pass the memo and briefing and press Award.
 */

type Row = Record<string, any>;
let db: Record<string, Row[]>;
let nextId = 0;

function table(name: string) {
  const filters: [string, string, unknown][] = [];
  const ins: [string, unknown[]][] = [];
  let op: "select" | "insert" | "update" | "upsert" = "select";
  let payload: any = null;
  let opts: any = {};
  let lim = Infinity;
  const match = (r: Row) =>
    filters.every(([kind, col, v]) => (kind === "eq" ? r[col] === v : r[col] !== v)) &&
    ins.every(([col, vs]) => vs.includes(r[col]));
  const run = () => {
    const rows = db[name] ?? (db[name] = []);
    if (op === "select") return rows.filter(match).slice(0, lim);
    if (op === "update") {
      const hit = rows.filter(match);
      hit.forEach((r) => Object.assign(r, payload));
      return hit;
    }
    const list = Array.isArray(payload) ? payload : [payload];
    const out: Row[] = [];
    for (const p of list) {
      if (op === "upsert") {
        const keys = String(opts.onConflict).split(",");
        if (rows.some((r) => keys.every((k) => r[k] === p[k]))) continue;
      }
      const r = { id: `id-${++nextId}`, ...p };
      rows.push(r);
      out.push(r);
    }
    return out;
  };
  const q: any = {
    select: () => q,
    insert: (p: any) => ((op = "insert"), (payload = p), q),
    update: (p: any) => ((op = "update"), (payload = p), q),
    upsert: (p: any, o: any) => ((op = "upsert"), (payload = p), (opts = o), q),
    eq: (c: string, v: unknown) => (filters.push(["eq", c, v]), q),
    neq: (c: string, v: unknown) => (filters.push(["neq", c, v]), q),
    in: (c: string, vs: unknown[]) => (ins.push([c, vs]), q),
    order: () => q,
    limit: (n: number) => ((lim = n), q),
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => {
      const r = run()[0];
      return r ? { data: r, error: null } : { data: null, error: { message: "none" } };
    },
    then: (res: (v: unknown) => unknown) => res({ data: run(), error: null }),
  };
  return q;
}
const service: any = { from: (t: string) => table(t) };

const MOS100 = "course-100";
beforeEach(() => {
  nextId = 0;
  db = {
    certifications: [
      { id: "c-done", course_id: MOS100, status: "active", validity_months: null, award_requires_course_id: null },
      { id: "c-off", course_id: MOS100, status: "inactive", validity_months: null, award_requires_course_id: null },
      { id: "c-mc", course_id: null, status: "active", validity_months: 60, award_requires_course_id: MOS100 },
    ],
    user_certifications: [],
    users: [{ id: "u1" }, { id: "u2" }],
    enrollments: [{ id: "e1", user_id: "u1", course_id: MOS100, status: "completed" }],
  };
});

describe("expiryFor", () => {
  it("is null without a validity", () => {
    expect(expiryFor(null, new Date("2026-11-11T00:00:00Z"))).toBeNull();
  });
  it("adds whole months, clamping to month end", () => {
    expect(expiryFor(60, new Date("2026-11-11T10:00:00Z"))).toBe("2031-11-11T10:00:00.000Z");
    expect(expiryFor(12, new Date("2028-02-29T00:00:00Z"))).toBe("2029-02-28T00:00:00.000Z");
  });
});

describe("issueCourseCompletionCertificates", () => {
  it("issues only the course's active completion certificate, never Mosaic Certified", async () => {
    const issued = await issueCourseCompletionCertificates(service, { userId: "u1", courseId: MOS100 });
    expect(issued).toEqual(["c-done"]);
    expect(db.user_certifications.map((r) => r.certification_id)).toEqual(["c-done"]);
    expect(db.user_certifications[0]).toMatchObject({ status: "active", expires_at: null });
  });
  it("keeps the first certificate on a second completion", async () => {
    await issueCourseCompletionCertificates(service, { userId: "u1", courseId: MOS100 });
    const again = await issueCourseCompletionCertificates(service, { userId: "u1", courseId: MOS100 });
    expect(again).toEqual([]);
    expect(db.user_certifications).toHaveLength(1);
  });
  it("issues nothing for a course without a certificate", async () => {
    expect(await issueCourseCompletionCertificates(service, { userId: "u1", courseId: "other" })).toEqual([]);
  });
});

describe("awardCertification", () => {
  const base = { awardedBy: "admin", memoPassedOn: "2026-11-10", briefingPassedOn: "2026-11-11" };

  it("awards Mosaic Certified for five years with the assessor's dates", async () => {
    const r = await awardCertification(service, {
      ...base,
      certificationId: "c-mc",
      userId: "u1",
      now: new Date("2026-11-11T12:00:00Z"),
    });
    expect(r).toMatchObject({ ok: true, reawarded: false });
    expect(db.user_certifications[0]).toMatchObject({
      certification_id: "c-mc",
      status: "active",
      expires_at: "2031-11-11T12:00:00.000Z",
      metadata: { issued_by: "staff_award", memo_passed_on: "2026-11-10", briefing_passed_on: "2026-11-11" },
    });
  });

  it("refuses a learner who hasn't completed the required course", async () => {
    const r = await awardCertification(service, { ...base, certificationId: "c-mc", userId: "u2" });
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(db.user_certifications).toHaveLength(0);
  });

  it("refuses a course-completion certificate", async () => {
    const r = await awardCertification(service, { ...base, certificationId: "c-done", userId: "u1" });
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it("refuses a second award, and reactivates after a revoke", async () => {
    const first = await awardCertification(service, { ...base, certificationId: "c-mc", userId: "u1" });
    expect(first.ok).toBe(true);
    expect(await awardCertification(service, { ...base, certificationId: "c-mc", userId: "u1" })).toMatchObject({
      ok: false,
      status: 409,
    });
    const id = (first as { userCertificationId: string }).userCertificationId;
    await revokeCertification(service, { userCertificationId: id, revokedBy: "admin" });
    expect(db.user_certifications[0].status).toBe("revoked");
    const again = await awardCertification(service, { ...base, certificationId: "c-mc", userId: "u1" });
    expect(again).toMatchObject({ ok: true, reawarded: true });
    expect(db.user_certifications).toHaveLength(1);
    expect(db.user_certifications[0].status).toBe("active");
  });

  it("renews an expired certificate for another five years and starts its warnings over", async () => {
    const first = await awardCertification(service, {
      ...base, certificationId: "c-mc", userId: "u1", now: new Date("2021-11-01T00:00:00Z"),
    });
    expect(first.ok).toBe(true);
    Object.assign(db.user_certifications[0], { status: "expired", expiry_reminders_sent: [90, 30] });
    const renewed = await awardCertification(service, {
      ...base, certificationId: "c-mc", userId: "u1", now: new Date("2026-11-11T00:00:00Z"),
    });
    expect(renewed).toMatchObject({ ok: true, reawarded: true });
    expect(db.user_certifications[0]).toMatchObject({
      status: "active",
      expires_at: "2031-11-11T00:00:00.000Z",
      expiry_reminders_sent: [],
    });
  });
});

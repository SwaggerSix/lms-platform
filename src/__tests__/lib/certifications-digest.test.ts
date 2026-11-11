import { describe, it, expect, beforeEach, vi } from "vitest";

const sent = vi.hoisted(() => ({ emails: [] as any[] }));
vi.mock("@/lib/email/sender", () => ({
  sendEmail: async (m: any) => {
    sent.emails.push(m);
    return { success: true };
  },
}));

import { CAPSTONES } from "@/lib/certifications/capstone";
import { piecesToMark, scopedTo, digestText, sendWeeklyDigests, type CertDigest } from "@/lib/certifications/digest";

/**
 * The weekly "waiting on you" email: unmarked hand-ins (a briefing only once
 * its pushback answers are in), learners ready to award, and certificates
 * expiring soon — scoped like the Award screen, and nothing when nothing waits.
 */

const NOW = new Date("2026-11-16T13:05:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();
const mos = CAPSTONES["mosaic-practitioner"];
const sub = (o: Record<string, unknown>) => ({
  id: "s", user_id: "u", kind: "memo", attempt: 1, status: "submitted", file_path: "f", file_name: "f",
  link_url: null, learner_note: null, submitted_at: daysAgo(3), reviewed_at: null, feedback: null, ...o,
}) as any;

describe("piecesToMark", () => {
  it("lists a submitted memo but not a briefing still waiting on its pushback answers", () => {
    const subs = [sub({ id: "m", kind: "memo" }), sub({ id: "b", kind: "briefing" })];
    const pb = [{ id: "p1", submission_id: "b", position: 1, prompt_index: 0, revealed_at: daysAgo(3), answered_at: daysAgo(3), file_path: "x", recorded_in_browser: true }] as any;
    expect(piecesToMark(mos, subs, pb).map((m) => m.piece)).toEqual(["interpretation memo"]);
  });
  it("lists the briefing once all three answers are in", () => {
    const subs = [sub({ id: "b", kind: "briefing" })];
    const pb = [1, 2, 3].map((n) => ({ id: `p${n}`, submission_id: "b", position: n, prompt_index: n, revealed_at: daysAgo(3), answered_at: daysAgo(3), file_path: "x", recorded_in_browser: true })) as any;
    expect(piecesToMark(mos, subs, pb).map((m) => m.piece)).toEqual(["executive briefing"]);
  });
  it("looks only at the newest attempt", () => {
    const subs = [sub({ id: "m1", status: "resubmit", reviewed_at: daysAgo(5) }), sub({ id: "m2", attempt: 2, status: "passed", reviewed_at: daysAgo(1) })];
    expect(piecesToMark(mos, subs, [])).toEqual([]);
  });
});

describe("scopedTo and digestText", () => {
  const d: CertDigest = {
    certName: "Mosaic Certified",
    toMark: [{ learner: { id: "a", name: "Ann", org: "o1" }, piece: "interpretation memo", days: 4 }],
    ready: [{ id: "b", name: "Bo", org: "o2" }],
    expiring: [{ learner: { id: "c", name: "Cy", org: "o1" }, expiresAt: inDays(12) }],
  };
  it("shows an org admin only their own learners; a super admin everyone", () => {
    const mine = scopedTo(d, { role: "admin", organization_id: "o1" });
    expect(mine.toMark).toHaveLength(1);
    expect(mine.ready).toHaveLength(0);
    expect(mine.expiring).toHaveLength(1);
    expect(scopedTo(d, { role: "super_admin", organization_id: null }).ready).toHaveLength(1);
  });
  it("writes a plain summary", () => {
    const { subject, body } = digestText("Chris", [d]);
    expect(subject).toBe("Certifications: 1 to mark, 1 ready to award");
    expect(body).toContain("To mark: Ann's interpretation memo, waiting 4 days");
    expect(body).toContain("Ready to award: Bo");
    expect(body).toContain("Expires Nov 28, 2026: Cy");
  });
});

type Row = Record<string, any>;
let db: Record<string, Row[]>;
function table(name: string) {
  const preds: ((r: Row) => boolean)[] = [];
  const run = () => (db[name] ?? []).filter((r) => preds.every((p) => p(r)));
  const q: any = {
    select: () => q,
    eq: (c: string, v: unknown) => (preds.push((r) => r[c] === v), q),
    in: (c: string, v: unknown[]) => (preds.push((r) => v.includes(r[c])), q),
    not: (c: string) => (preds.push((r) => r[c] != null), q),
    order: () => q,
    limit: () => q,
    then: (res: (v: unknown) => unknown) => res({ data: run(), error: null }),
  };
  return q;
}
const service: any = { from: (t: string) => table(t) };

describe("sendWeeklyDigests", () => {
  beforeEach(() => {
    sent.emails = [];
    db = {
      certifications: [
        { id: "mc", name: "Mosaic Certified", status: "active", capstone_key: "mosaic-practitioner", award_requires_course_id: "mos100", notify_user_ids: ["chris"] },
        { id: "sc", name: "SurveyCraft Specialist", status: "active", capstone_key: "surveycraft-specialist", award_requires_course_id: "mos220", notify_user_ids: [] },
      ],
      users: [
        { id: "chris", email: "chris@example.com", first_name: "Chris", role: "super_admin", organization_id: null },
        { id: "ann", first_name: "Ann", last_name: "A", email: "ann@example.com", organization_id: "o1" },
        { id: "bo", first_name: "Bo", last_name: "B", email: "bo@example.com", organization_id: "o1" },
      ],
      certification_submissions: [
        { ...sub({ id: "m-ann", user_id: "ann" }), certification_id: "mc" },
        { ...sub({ id: "m-bo", user_id: "bo", status: "passed", reviewed_at: daysAgo(2) }), certification_id: "mc" },
        { ...sub({ id: "d-bo", user_id: "bo", kind: "dig", status: "passed", reviewed_at: daysAgo(2) }), certification_id: "mc" },
        { ...sub({ id: "s-bo", user_id: "bo", kind: "signal", status: "passed", reviewed_at: daysAgo(2) }), certification_id: "mc" },
        { ...sub({ id: "b-bo", user_id: "bo", kind: "briefing", status: "passed", reviewed_at: daysAgo(1) }), certification_id: "mc" },
        { ...sub({ id: "p-x", user_id: "ann", kind: "practical" }), certification_id: "sc" },
      ],
      certification_pushback_answers: [],
      user_certifications: [],
      enrollments: [{ user_id: "bo", course_id: "mos100", status: "completed" }],
    };
  });

  it("emails each reader one summary, skipping certifications nobody looks after", async () => {
    const out = await sendWeeklyDigests(service, NOW);
    expect(out.sent).toBe(1);
    expect(sent.emails[0].to).toBe("chris@example.com");
    expect(sent.emails[0].text).toContain("To mark: Ann A's interpretation memo, waiting 3 days");
    expect(sent.emails[0].text).toContain("Ready to award: Bo B");
    expect(sent.emails[0].text).not.toContain("SurveyCraft");
  });

  it("sends nothing when nothing is waiting", async () => {
    db.certification_submissions = [];
    expect((await sendWeeklyDigests(service, NOW)).sent).toBe(0);
    expect(sent.emails).toHaveLength(0);
  });

  it("drops a learner who already holds a current certificate", async () => {
    db.user_certifications = [{ user_id: "bo", certification_id: "mc", status: "active", expires_at: inDays(900) }];
    await sendWeeklyDigests(service, NOW);
    expect(sent.emails[0].text).not.toContain("Ready to award");
  });
});

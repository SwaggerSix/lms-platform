import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/email/sender", () => ({ sendEmail: vi.fn(async () => ({ success: true, id: "x" })) }));

import {
  CAPSTONES,
  allowedDecisions,
  answeredLate,
  drawPrompts,
  isAcceptableLink,
  nextAttempt,
  passDates,
} from "@/lib/certifications/capstone";
import {
  answerPushback,
  revealPushback,
  reviewPiece,
  startUpload,
  submitPiece,
  reopenPiece,
  learnerBlockedReason,
  type CapstoneCert,
} from "@/lib/certifications/capstone-service";
import { awardCertification } from "@/lib/certifications/issue";
import { sendEmail } from "@/lib/email/sender";

/**
 * Mosaic Practitioner Certified's one capstone (MOS-100 + MOS-230 + MOS-240):
 * the Culture Mosaic memo, the Culture Dig plan and synthesis, the Mosaic
 * Signal memo, and the recorded briefing plus three pushback questions drawn
 * at random, each marked by the assessor with one resubmission. It opens once
 * all three courses are finished, and Award needs every piece passed.
 */

type Row = Record<string, any>;
let db: Record<string, Row[]>;
let files: Set<string>;
let n = 0;

function table(name: string) {
  const f: ((r: Row) => boolean)[] = [];
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: any;
  let lim = Infinity;
  const run = () => {
    const rows = db[name] ?? (db[name] = []);
    const hit = rows.filter((r) => f.every((x) => x(r)));
    if (op === "select") return hit.slice(0, lim);
    if (op === "update") return hit.map((r) => Object.assign(r, payload));
    if (op === "delete") {
      db[name] = rows.filter((r) => !hit.includes(r));
      return hit;
    }
    const list = Array.isArray(payload) ? payload : [payload];
    const out: Row[] = [];
    for (const p of list) {
      if (name === "certification_submissions" && rows.some((r) => r.user_id === p.user_id && r.certification_id === p.certification_id && r.kind === p.kind && r.attempt === p.attempt)) {
        throw Object.assign(new Error("dup"), { code: "23505" });
      }
      const r = { id: `id-${++n}`, submitted_at: new Date().toISOString(), reviewed_at: null, revealed_at: null, answered_at: null, recorded_in_browser: false, ...p };
      rows.push(r);
      out.push(r);
    }
    return out;
  };
  const result = () => {
    try {
      return { data: run(), error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message, code: e.code } };
    }
  };
  const q: any = {
    select: () => q,
    insert: (p: any) => ((op = "insert"), (payload = p), q),
    update: (p: any) => ((op = "update"), (payload = p), q),
    delete: () => ((op = "delete"), q),
    eq: (c: string, v: unknown) => (f.push((r) => r[c] === v), q),
    in: (c: string, v: unknown[]) => (f.push((r) => v.includes(r[c])), q),
    is: (c: string, v: unknown) => (f.push((r) => (r[c] ?? null) === v), q),
    gt: (c: string, v: any) => (f.push((r) => r[c] > v), q),
    order: () => q,
    limit: (k: number) => ((lim = k), q),
    maybeSingle: async () => {
      const r = result();
      return { data: r.data?.[0] ?? null, error: r.error };
    },
    single: async () => {
      const r = result();
      return r.data?.[0] ? { data: r.data[0], error: null } : { data: null, error: r.error ?? { message: "none" } };
    },
    then: (res: (v: unknown) => unknown) => res(result()),
  };
  return q;
}
const service: any = {
  from: (t: string) => table(t),
  storage: {
    from: () => ({
      createSignedUploadUrl: async (path: string) => ({ data: { path, signedUrl: `https://up/${path}` }, error: null }),
      list: async (folder: string, o: { search: string }) => ({
        data: [...files].filter((p) => p === `${folder}/${o.search}`).map((p) => ({ name: p.split("/").pop() })),
        error: null,
      }),
    }),
  },
};

const cfg = CAPSTONES["mosaic-practitioner"];
const BUNDLE = ["mos100", "mos230", "mos240"];
const cert: CapstoneCert = {
  id: "cert-mc",
  name: "Mosaic Practitioner Certified",
  status: "active",
  course_id: null,
  award_requires_course_id: null,
  award_requires_course_ids: BUNDLE,
  capstone_key: "mosaic-practitioner",
  notify_user_ids: ["chris"],
};
const U = "u1";
const memoPath = `${U}/cert-mc/memo-a.pdf`;
const digPath = `${U}/cert-mc/dig-a.pdf`;
const signalPath = `${U}/cert-mc/signal-a.pdf`;
const videoPath = `${U}/cert-mc/briefing-b.mp4`;
const pbPath = (i: number) => `${U}/cert-mc/pushback-${i}.webm`;

beforeEach(() => {
  n = 0;
  vi.mocked(sendEmail).mockClear();
  files = new Set([memoPath, digPath, signalPath, videoPath, pbPath(1), pbPath(2), pbPath(3)]);
  db = {
    certifications: [{ id: "cert-mc", name: cert.name, course_id: null, status: "active", validity_months: 60, award_requires_course_id: null, award_requires_course_ids: BUNDLE, capstone_key: "mosaic-practitioner" }],
    users: [
      { id: U, email: "learner@example.com", first_name: "Lee", last_name: "Learner" },
      { id: "chris", email: "assessor@example.com", first_name: "A", last_name: "Assessor" },
    ],
    enrollments: BUNDLE.map((c, i) => ({ id: `e${i}`, user_id: U, course_id: c, status: "completed", completed_at: `2026-11-0${i + 1}T00:00:00Z` })),
    certification_submissions: [],
    certification_pushback_answers: [],
    user_certifications: [],
  };
});

describe("rules", () => {
  it("draws distinct prompts from the bank", () => {
    for (let i = 0; i < 50; i++) {
      const p = drawPrompts(cfg.pushback!.bank.length, 3);
      expect(new Set(p).size).toBe(3);
      expect(p.every((x) => x >= 0 && x < 8)).toBe(true);
    }
  });
  it("allows one resubmission, then pass or not pass", () => {
    expect(nextAttempt([], "memo")).toBe(1);
    expect(nextAttempt([{ kind: "memo", attempt: 1, status: "submitted", reviewed_at: null }], "memo")).toBeNull();
    expect(nextAttempt([{ kind: "memo", attempt: 1, status: "resubmit", reviewed_at: "x" }], "memo")).toBe(2);
    expect(nextAttempt([{ kind: "memo", attempt: 2, status: "not_passed", reviewed_at: "x" }], "memo")).toBeNull();
    expect(allowedDecisions(1)).toEqual(["passed", "resubmit"]);
    expect(allowedDecisions(2)).toEqual(["passed", "not_passed"]);
  });
  it("only takes https links", () => {
    expect(isAcceptableLink("https://www.loom.com/share/abc")).toBe(true);
    expect(isAcceptableLink("http://example.com/x")).toBe(false);
    expect(isAcceptableLink("javascript:alert(1)")).toBe(false);
    expect(isAcceptableLink("not a url")).toBe(false);
  });
  it("flags an answer well past think + answer time", () => {
    expect(answeredLate(cfg, 200)).toBe(false);
    expect(answeredLate(cfg, 300)).toBe(true);
  });
  it("gives pass dates only when both pieces passed", () => {
    const m = { kind: "memo" as const, attempt: 1, status: "passed" as const, reviewed_at: "2026-11-20T10:00:00Z" };
    const b = { kind: "briefing" as const, attempt: 2, status: "passed" as const, reviewed_at: "2026-11-25T10:00:00Z" };
    expect(passDates([m], ["memo", "briefing"])).toBeNull();
    expect(passDates([m, b], ["memo", "briefing"])).toEqual({ memo: "2026-11-20", briefing: "2026-11-25" });
  });
});

describe("uploads", () => {
  it("refuses the wrong type and anything over 50 MB, pointing a big briefing at a link", async () => {
    expect(await startUpload(service, { userId: U, certificationId: "cert-mc", slot: "memo", fileKind: "document", fileSize: 1000, contentType: "image/png" })).toMatchObject({ ok: false, status: 400 });
    const big = await startUpload(service, { userId: U, certificationId: "cert-mc", slot: "briefing", fileKind: "video", linkInstead: true, fileSize: 60 * 1024 * 1024, contentType: "video/mp4" });
    expect(big).toMatchObject({ ok: false, status: 400 });
    expect((big as any).error).toMatch(/link/);
    const ok = await startUpload(service, { userId: U, certificationId: "cert-mc", slot: "memo", fileKind: "document", fileSize: 1000, contentType: "application/pdf" });
    expect(ok).toMatchObject({ ok: true });
    expect((ok as any).path.startsWith(`${U}/cert-mc/memo-`)).toBe(true);
  });
});

describe("hand in, pushback, marking, award", () => {
  it("runs the whole capstone", async () => {
    // Memo: a file is required; someone else's path is refused.
    expect(await submitPiece(service, { userId: U, cert, cfg, kind: "memo", link: "https://x.example/doc" })).toMatchObject({ ok: false });
    expect(await submitPiece(service, { userId: U, cert, cfg, kind: "memo", filePath: "u2/cert-mc/memo-a.pdf" })).toMatchObject({ ok: false, status: 400 });
    const memo = await submitPiece(service, { userId: U, cert, cfg, kind: "memo", filePath: memoPath, fileName: "memo.pdf" });
    expect(memo).toMatchObject({ ok: true, attempt: 1 });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: ["assessor@example.com"] }));
    expect(await submitPiece(service, { userId: U, cert, cfg, kind: "memo", filePath: memoPath })).toMatchObject({ ok: false, status: 409 });

    // Briefing by link draws three questions; none is visible until shown.
    const br = await submitPiece(service, { userId: U, cert, cfg, kind: "briefing", link: "https://www.loom.com/share/abc" });
    expect(br).toMatchObject({ ok: true });
    const bid = (br as any).submissionId;
    expect(db.certification_pushback_answers.filter((p) => p.submission_id === bid)).toHaveLength(3);

    // Questions go in order; showing twice keeps the first time.
    expect(await revealPushback(service, { userId: U, cert, cfg, submissionId: bid, position: 2 })).toMatchObject({ ok: false, status: 409 });
    const t0 = new Date("2026-11-11T10:00:00Z");
    const r1 = await revealPushback(service, { userId: U, cert, cfg, submissionId: bid, position: 1, now: t0 });
    expect(r1).toMatchObject({ ok: true, revealedAt: t0.toISOString() });
    const r1b = await revealPushback(service, { userId: U, cert, cfg, submissionId: bid, position: 1, now: new Date("2026-11-11T11:00:00Z") });
    expect((r1b as any).revealedAt).toBe(t0.toISOString());
    // Another learner can't touch it.
    expect(await revealPushback(service, { userId: "u2", cert, cfg, submissionId: bid, position: 1 })).toMatchObject({ ok: false, status: 404 });

    // Marking the briefing waits for all three answers.
    expect(await reviewPiece(service, { submissionId: bid, reviewerId: "chris", decision: "passed" })).toMatchObject({ ok: false, status: 409 });

    for (const pos of [1, 2, 3]) {
      if (pos > 1) await revealPushback(service, { userId: U, cert, cfg, submissionId: bid, position: pos });
      expect(await answerPushback(service, { userId: U, cert, submissionId: bid, position: pos, filePath: pbPath(pos), recordedInBrowser: true })).toMatchObject({ ok: true });
    }
    expect(await answerPushback(service, { userId: U, cert, submissionId: bid, position: 3, filePath: pbPath(3), recordedInBrowser: true })).toMatchObject({ ok: false, status: 409 });

    // Award is refused until both pieces have passed.
    expect(await awardCertification(service, { certificationId: "cert-mc", userId: U, awardedBy: "chris" })).toMatchObject({ ok: false, status: 409 });

    // Memo sent back needs feedback; then a second attempt can't be sent back again.
    const mid = (memo as any).submissionId;
    expect(await reviewPiece(service, { submissionId: mid, reviewerId: "chris", decision: "resubmit" })).toMatchObject({ ok: false, status: 400 });
    expect(await reviewPiece(service, { submissionId: mid, reviewerId: "chris", decision: "resubmit", feedback: "Add limits." })).toMatchObject({ ok: true });
    expect(sendEmail).toHaveBeenLastCalledWith(expect.objectContaining({ to: "learner@example.com" }));
    const memo2 = await submitPiece(service, { userId: U, cert, cfg, kind: "memo", filePath: memoPath });
    expect(memo2).toMatchObject({ ok: true, attempt: 2 });
    const m2 = (memo2 as any).submissionId;
    expect(await reviewPiece(service, { submissionId: m2, reviewerId: "chris", decision: "resubmit", feedback: "x" })).toMatchObject({ ok: false, status: 400 });
    expect(await reviewPiece(service, { submissionId: m2, reviewerId: "chris", decision: "passed", now: new Date("2026-11-20T09:00:00Z") })).toMatchObject({ ok: true });
    expect(await reviewPiece(service, { submissionId: m2, reviewerId: "chris", decision: "passed" })).toMatchObject({ ok: false, status: 409 });
    expect(await reviewPiece(service, { submissionId: bid, reviewerId: "chris", decision: "passed", now: new Date("2026-11-21T09:00:00Z") })).toMatchObject({ ok: true });

    // The Culture Dig and Mosaic Signal pieces are part of the same capstone.
    expect(await awardCertification(service, { certificationId: "cert-mc", userId: U, awardedBy: "chris" })).toMatchObject({ ok: false, status: 409 });
    for (const [kind, path] of [["dig", digPath], ["signal", signalPath]] as const) {
      const sub = await submitPiece(service, { userId: U, cert, cfg, kind, filePath: path });
      expect(sub).toMatchObject({ ok: true, attempt: 1 });
      expect(await reviewPiece(service, { submissionId: (sub as any).submissionId, reviewerId: "chris", decision: "passed", now: new Date("2026-11-22T09:00:00Z") })).toMatchObject({ ok: true });
    }

    // Now Award works and records the marked dates, whatever the form said.
    const aw = await awardCertification(service, { certificationId: "cert-mc", userId: U, awardedBy: "chris", memoPassedOn: "1999-01-01", briefingPassedOn: "1999-01-01" });
    expect(aw).toMatchObject({ ok: true });
    expect(db.user_certifications[0].metadata).toMatchObject({
      memo_passed_on: "2026-11-20",
      briefing_passed_on: "2026-11-21",
      pieces_passed_on: { memo: "2026-11-20", dig: "2026-11-22", signal: "2026-11-22", briefing: "2026-11-21" },
    });
  });
});

describe("Specialist practicals (MOS-210, MOS-220)", () => {
  const sc = CAPSTONES["surveycraft-specialist"];
  const scCert: CapstoneCert = { ...cert, id: "cert-sc", name: "Certified · SurveyCraft Specialist", award_requires_course_id: "mos220", capstone_key: "surveycraft-specialist" };
  const doc = `${U}/cert-sc/practical-a.pdf`;

  beforeEach(() => {
    files.add(doc);
    db.certifications.push({ id: "cert-sc", name: scCert.name, course_id: null, status: "active", validity_months: 60, award_requires_course_id: "mos220", capstone_key: "surveycraft-specialist" });
    db.enrollments.push({ id: "e2", user_id: U, course_id: "mos220", status: "completed" });
  });

  it("every Specialist credential has one practical piece and no pushback", () => {
    for (const key of ["coaching-studio-specialist", "surveycraft-specialist"]) {
      expect(CAPSTONES[key].pieces.map((p) => p.kind)).toEqual(["practical"]);
      expect(CAPSTONES[key].pushback).toBeNull();
    }
  });

  it("SurveyCraft needs the survey link, its name and the document", async () => {
    const base = { userId: U, cert: scCert, cfg: sc, kind: "practical" as const };
    expect(await submitPiece(service, { ...base, filePath: doc, note: "Decision-rights pulse" })).toMatchObject({ ok: false, status: 400 });
    expect(await submitPiece(service, { ...base, link: "https://www.mosaicsurvey.com/s/abc", note: "Decision-rights pulse" })).toMatchObject({ ok: false, status: 400 });
    const noName = await submitPiece(service, { ...base, filePath: doc, link: "https://www.mosaicsurvey.com/s/abc" });
    expect(noName).toMatchObject({ ok: false, status: 400 });
    expect((noName as any).error).toBe("Add the survey's exact name in the Mosaic Practice Workspace.");
    const ok = await submitPiece(service, { ...base, filePath: doc, link: "https://www.mosaicsurvey.com/s/abc", note: "Decision-rights pulse" });
    expect(ok).toMatchObject({ ok: true, attempt: 1 });
    expect(db.certification_pushback_answers).toHaveLength(0);
    const row = db.certification_submissions.find((r) => r.kind === "practical");
    expect(row).toMatchObject({ link_url: "https://www.mosaicsurvey.com/s/abc", learner_note: "Decision-rights pulse" });

    // Award waits for the practical, then records its date.
    expect(await awardCertification(service, { certificationId: "cert-sc", userId: U, awardedBy: "chris" })).toMatchObject({ ok: false, status: 409 });
    expect(await reviewPiece(service, { submissionId: (ok as any).submissionId, reviewerId: "chris", decision: "passed", now: new Date("2026-11-30T09:00:00Z") })).toMatchObject({ ok: true });
    expect(await awardCertification(service, { certificationId: "cert-sc", userId: U, awardedBy: "chris" })).toMatchObject({ ok: true });
    const held = db.user_certifications.find((r) => r.certification_id === "cert-sc");
    expect(held?.metadata.pieces_passed_on).toEqual({ practical: "2026-11-30" });
  });

  it("a practical can't be handed in for a credential that doesn't ask for one", async () => {
    expect(await submitPiece(service, { userId: U, cert, cfg, kind: "practical", filePath: memoPath })).toMatchObject({ ok: false, status: 404 });
  });
});

describe("one Mosaic Practitioner capstone across MOS-100, MOS-230 and MOS-240", () => {
  it("has four pieces, and the Culture Dig and Mosaic Signal Specialists are gone", () => {
    expect(cfg.pieces.map((p) => p.kind)).toEqual(["memo", "dig", "signal", "briefing"]);
    expect(CAPSTONES["culture-dig-specialist"]).toBeUndefined();
    expect(CAPSTONES["mosaic-signal-specialist"]).toBeUndefined();
  });

  it("opens only once all three courses are finished, and says which", async () => {
    db.courses = [
      { id: "mos100", title: "MOS-100 Mosaic Practitioner Certification" },
      { id: "mos230", title: "MOS-230 Culture Dig Certification" },
      { id: "mos240", title: "MOS-240 Mosaic Signal Certification" },
    ];
    db.enrollments.find((e) => e.course_id === "mos240")!.status = "in_progress";
    expect(await learnerBlockedReason(service, U, cert)).toBe(
      "Your capstone opens once you've finished MOS-100, MOS-230 and MOS-240, final exams included."
    );
    db.enrollments.find((e) => e.course_id === "mos240")!.status = "completed";
    expect(await learnerBlockedReason(service, U, cert)).toBeNull();
  });

  it("refuses Award until every course is finished, even with every piece passed", async () => {
    for (const [kind, path] of [["memo", memoPath], ["dig", digPath], ["signal", signalPath]] as const) {
      const sub = await submitPiece(service, { userId: U, cert, cfg, kind, filePath: path });
      await reviewPiece(service, { submissionId: (sub as any).submissionId, reviewerId: "chris", decision: "passed" });
    }
    db.certification_submissions.push({ id: "b", user_id: U, certification_id: "cert-mc", kind: "briefing", attempt: 1, status: "passed", reviewed_at: "2026-11-21T00:00:00Z" });
    db.enrollments = db.enrollments.filter((e) => e.course_id !== "mos230");
    const refused = await awardCertification(service, { certificationId: "cert-mc", userId: U, awardedBy: "chris" });
    expect(refused).toMatchObject({ ok: false, status: 409 });
    expect((refused as any).error).toContain("all the required courses");
    db.enrollments.push({ id: "e9", user_id: U, course_id: "mos230", status: "completed" });
    expect(await awardCertification(service, { certificationId: "cert-mc", userId: U, awardedBy: "chris" })).toMatchObject({ ok: true });
  });

  it("tells the learner about a call after a second fail", async () => {
    const first = await submitPiece(service, { userId: U, cert, cfg, kind: "signal", filePath: signalPath });
    await reviewPiece(service, { submissionId: (first as any).submissionId, reviewerId: "chris", decision: "resubmit", feedback: "Cut the group of 6." });
    const second = await submitPiece(service, { userId: U, cert, cfg, kind: "signal", filePath: signalPath });
    await reviewPiece(service, { submissionId: (second as any).submissionId, reviewerId: "chris", decision: "not_passed", feedback: "Still there." });
    expect(vi.mocked(sendEmail).mock.lastCall?.[0]).toMatchObject({ to: "learner@example.com" });
    expect((vi.mocked(sendEmail).mock.lastCall?.[0] as any).text).toContain("set up a call");
  });
});

describe("reopen after the call", () => {
  async function failTwice() {
    const first = await submitPiece(service, { userId: U, cert, cfg, kind: "memo", filePath: memoPath });
    await reviewPiece(service, { submissionId: (first as any).submissionId, reviewerId: "chris", decision: "resubmit", feedback: "Add limits." });
    const second = await submitPiece(service, { userId: U, cert, cfg, kind: "memo", filePath: memoPath });
    await reviewPiece(service, { submissionId: (second as any).submissionId, reviewerId: "chris", decision: "not_passed", feedback: "Still missing." });
    return (second as any).submissionId as string;
  }

  it("blocks a third hand-in until the assessor reopens it, then allows exactly one more", async () => {
    const failed = await failTwice();
    expect(await submitPiece(service, { userId: U, cert, cfg, kind: "memo", filePath: memoPath })).toMatchObject({ ok: false, status: 409 });

    vi.mocked(sendEmail).mockClear();
    expect(await reopenPiece(service, { submissionId: failed, reopenedBy: "chris", note: "As agreed, focus on limits." })).toMatchObject({ ok: true });
    const mail = vi.mocked(sendEmail).mock.lastCall?.[0] as any;
    expect(mail.to).toBe("learner@example.com");
    expect(mail.subject).toContain("open again");
    expect(mail.text).toContain("As agreed, focus on limits.");

    // Reopening twice is refused.
    expect(await reopenPiece(service, { submissionId: failed, reopenedBy: "chris" })).toMatchObject({ ok: false, status: 409 });

    const third = await submitPiece(service, { userId: U, cert, cfg, kind: "memo", filePath: memoPath });
    expect(third).toMatchObject({ ok: true, attempt: 3 });
    // The reopened hand-in can't be reopened again once a newer attempt exists,
    // and attempt 3 is marked Pass or Not passed.
    expect(await reviewPiece(service, { submissionId: (third as any).submissionId, reviewerId: "chris", decision: "resubmit", feedback: "x" })).toMatchObject({ ok: false, status: 400 });
    expect(await reviewPiece(service, { submissionId: (third as any).submissionId, reviewerId: "chris", decision: "passed" })).toMatchObject({ ok: true });
    expect(await submitPiece(service, { userId: U, cert, cfg, kind: "memo", filePath: memoPath })).toMatchObject({ ok: false, status: 409 });
  });

  it("only reopens a piece marked Not passed", async () => {
    const first = await submitPiece(service, { userId: U, cert, cfg, kind: "memo", filePath: memoPath });
    expect(await reopenPiece(service, { submissionId: (first as any).submissionId, reopenedBy: "chris" })).toMatchObject({ ok: false, status: 409 });
    await reviewPiece(service, { submissionId: (first as any).submissionId, reviewerId: "chris", decision: "resubmit", feedback: "x" });
    expect(await reopenPiece(service, { submissionId: (first as any).submissionId, reopenedBy: "chris" })).toMatchObject({ ok: false, status: 409 });
  });
});


import { describe, it, expect, beforeEach, vi } from "vitest";

const sent = vi.hoisted(() => ({ emails: [] as any[], portal: [] as [string, string][] }));
vi.mock("@/lib/email/sender", () => ({
  sendEmail: async (m: any) => {
    sent.emails.push(m);
    return { success: true };
  },
}));
vi.mock("@/lib/integrations/partner-portal/certification", () => ({
  syncCertificationToPortal: async (_s: unknown, id: string, action: string) => {
    sent.portal.push([id, action]);
    return "updated";
  },
}));

import { reminderDue, tiersCovered, runExpirySweep } from "@/lib/certifications/expiry";

/**
 * Certificates running out: two warnings (90 and 30 days), then "expired" —
 * the row flips to expired and the portal hears, so a partner's +5% doesn't
 * outlive the certification behind it.
 */

const NOW = new Date("2026-11-11T14:10:00Z");
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

describe("reminderDue", () => {
  it("sends nothing outside 90 days or once lapsed", () => {
    expect(reminderDue(inDays(120), [], NOW)).toBeNull();
    expect(reminderDue(inDays(-1), [], NOW)).toBeNull();
  });
  it("sends the 90-day warning inside 90 days, once", () => {
    expect(reminderDue(inDays(89), [], NOW)).toBe(90);
    expect(reminderDue(inDays(89), [90], NOW)).toBeNull();
  });
  it("sends the 30-day warning inside 30 days even after the 90", () => {
    expect(reminderDue(inDays(29), [90], NOW)).toBe(30);
    expect(reminderDue(inDays(29), [90, 30], NOW)).toBeNull();
  });
  it("sends only the nearest warning to a certificate first seen late", () => {
    expect(reminderDue(inDays(10), [], NOW)).toBe(30);
    expect(tiersCovered(30)).toEqual([90, 30]);
  });
});

type Row = Record<string, any>;
let db: Record<string, Row[]>;

const val = (r: Row, c: string) => (Array.isArray(r[c]) ? `{${r[c].join(",")}}` : r[c]);
function table(name: string) {
  const preds: ((r: Row) => boolean)[] = [];
  let op: "select" | "update" = "select";
  let payload: any = null;
  const run = () => {
    const rows = (db[name] ?? []).filter((r) => preds.every((p) => p(r)));
    if (op === "update") rows.forEach((r) => Object.assign(r, payload));
    return rows;
  };
  const q: any = {
    select: () => q,
    update: (p: any) => ((op = "update"), (payload = p), q),
    eq: (c: string, v: unknown) => (preds.push((r) => val(r, c) === v), q),
    in: (c: string, v: unknown[]) => (preds.push((r) => v.includes(r[c])), q),
    lte: (c: string, v: string) => (preds.push((r) => r[c] != null && r[c] <= v), q),
    gt: (c: string, v: string) => (preds.push((r) => r[c] != null && r[c] > v), q),
    limit: () => q,
    then: (res: (v: unknown) => unknown) => res({ data: run(), error: null }),
  };
  return q;
}
const service: any = { from: (t: string) => table(t) };

const mosaic = { name: "Mosaic Certified", course_id: null, capstone_key: "mosaic-practitioner", notify_user_ids: ["staff"], recertification_course: null };
const plain = { name: "Safety", course_id: "c1", capstone_key: null, notify_user_ids: [], recertification_course: { title: "Safety Refresher" } };
const learner = { email: "lee@example.com", first_name: "Lee" };

beforeEach(() => {
  sent.emails = [];
  sent.portal = [];
  db = {
    users: [{ id: "staff", email: "assessor@example.com" }],
    user_certifications: [
      { id: "lapsed", status: "active", expires_at: inDays(-1), expiry_reminders_sent: [90, 30], user: learner, certification: mosaic },
      { id: "lapsed-plain", status: "active", expires_at: inDays(-2), expiry_reminders_sent: [], user: learner, certification: plain },
      { id: "soon", status: "active", expires_at: inDays(60), expiry_reminders_sent: [], user: learner, certification: mosaic },
      { id: "very-soon", status: "active", expires_at: inDays(20), expiry_reminders_sent: [90], user: learner, certification: plain },
      { id: "far", status: "active", expires_at: inDays(400), expiry_reminders_sent: [], user: learner, certification: mosaic },
      { id: "revoked", status: "revoked", expires_at: inDays(-5), expiry_reminders_sent: [], user: learner, certification: mosaic },
    ],
  };
});

const row = (id: string) => db.user_certifications.find((r) => r.id === id)!;

describe("runExpirySweep", () => {
  it("expires lapsed certificates, emails the holder and tells the portal about tracked credentials", async () => {
    const out = await runExpirySweep(service, NOW);
    expect(row("lapsed").status).toBe("expired");
    expect(row("lapsed-plain").status).toBe("expired");
    expect(row("revoked").status).toBe("revoked");
    expect(out.expired).toBe(2);
    // Only the credential the portal tracks is synced.
    expect(sent.portal).toEqual([["lapsed", "expire"]]);
    const expiredMail = sent.emails.filter((m) => m.subject.includes("has expired"));
    expect(expiredMail).toHaveLength(2);
  });

  it("sends each warning once and records it", async () => {
    await runExpirySweep(service, NOW);
    expect(row("soon").expiry_reminders_sent).toEqual([90]);
    expect(row("very-soon").expiry_reminders_sent).toEqual([90, 30]);
    expect(row("far").expiry_reminders_sent).toEqual([]);
    const warnings = sent.emails.filter((m) => m.subject.includes("expires in"));
    expect(warnings.map((m) => m.subject).sort()).toEqual(["Mosaic Certified expires in 60 days", "Safety expires in 20 days"]);

    sent.emails = [];
    const again = await runExpirySweep(service, NOW);
    expect(again.reminded).toBe(0);
    expect(again.expired).toBe(0);
    expect(sent.emails).toHaveLength(0);
  });

  it("says how to renew: the assessor (reply-to) or the recertification course", async () => {
    await runExpirySweep(service, NOW);
    const mc = sent.emails.find((m) => m.subject.startsWith("Mosaic Certified expires"));
    expect(mc.text).toContain("reply to this email");
    expect(mc.replyTo).toBe("assessor@example.com");
    const safety = sent.emails.find((m) => m.subject.startsWith("Safety expires"));
    expect(safety.text).toContain('complete "Safety Refresher"');
    expect(safety.replyTo).toBeUndefined();
  });
});

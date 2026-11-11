/**
 * The weekly "waiting on you" email for staff who mark certification work.
 *
 * Handing work in already emails the staff who ticked "Email me when a
 * learner hands in work" on a certification (notify_user_ids). Nothing
 * followed up if that email was missed, so once a week
 * (/api/cron/certification-digest) each of them gets one summary across every
 * certification they're on:
 *
 * - work to mark: the newest hand-in of a piece is still "submitted" (and, for
 *   a briefing, all its pushback answers are in, so it can actually be marked),
 *   with how long it has waited;
 * - ready to award: every piece passed and the required course completed, but
 *   no current certificate (an expired holder shows here too — Award renews);
 * - expiring within 30 days: so a renewal can be arranged before it lapses.
 *
 * Nothing waiting, no email. An org admin hears only about learners in their
 * own organization, as on the Award screen; a super admin about everyone.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/sender";
import { customTemplate } from "@/lib/email/templates";
import { capstoneFor, latestOf, passDates, type CapstoneConfig } from "./capstone";
import { submissionsFor, type PushbackRow, type SubmissionRow } from "./capstone-service";

const DAY_MS = 86_400_000;
export const DIGEST_EXPIRING_DAYS = 30;

export interface ToMark {
  userId: string;
  piece: string;
  submittedAt: string;
}

/** Pieces whose newest hand-in is waiting for a mark and can be marked now. */
export function piecesToMark(cfg: CapstoneConfig, subs: SubmissionRow[], pushback: PushbackRow[]): ToMark[] {
  const out: ToMark[] = [];
  const users = [...new Set(subs.map((s) => s.user_id))];
  for (const uid of users) {
    const mine = subs.filter((s) => s.user_id === uid);
    for (const pc of cfg.pieces) {
      const s = latestOf(mine, pc.kind);
      if (!s || s.status !== "submitted") continue;
      if (pc.pushback && cfg.pushback) {
        const answered = pushback.filter((p) => p.submission_id === s.id && p.answered_at).length;
        if (answered < cfg.pushback.count) continue;
      }
      out.push({ userId: uid, piece: pc.noun, submittedAt: s.submitted_at });
    }
  }
  return out;
}

/** Learners with every piece passed. */
export function allPiecesPassed(cfg: CapstoneConfig, subs: SubmissionRow[]): string[] {
  const users = [...new Set(subs.map((s) => s.user_id))];
  return users.filter((uid) =>
    passDates(subs.filter((s) => s.user_id === uid), cfg.pieces.map((p) => p.kind))
  );
}

export function daysWaiting(since: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / DAY_MS));
}

interface Person {
  id: string;
  name: string;
  org: string | null;
}

export interface CertDigest {
  certName: string;
  toMark: { learner: Person; piece: string; days: number }[];
  ready: Person[];
  expiring: { learner: Person; expiresAt: string }[];
}

/** What is waiting on one certification, whoever is reading. */
export async function digestFor(
  service: SupabaseClient,
  cert: { id: string; name: string; capstone_key: string; award_requires_course_id: string | null },
  now: Date
): Promise<CertDigest | null> {
  const cfg = capstoneFor(cert.capstone_key);
  if (!cfg) return null;
  const { subs, pushback } = await submissionsFor(service, cert.id);

  const { data: holdings } = await service
    .from("user_certifications")
    .select("user_id, status, expires_at")
    .eq("certification_id", cert.id)
    .limit(2000);
  const current = new Set(
    (holdings ?? [])
      .filter((h: { status: string; expires_at: string | null }) =>
        h.status === "active" && (!h.expires_at || new Date(h.expires_at) > now))
      .map((h: { user_id: string }) => h.user_id)
  );
  const horizon = now.getTime() + DIGEST_EXPIRING_DAYS * DAY_MS;
  const expiringRows = (holdings ?? []).filter(
    (h: { status: string; expires_at: string | null }) =>
      h.status === "active" && !!h.expires_at &&
      new Date(h.expires_at).getTime() > now.getTime() && new Date(h.expires_at).getTime() <= horizon
  ) as { user_id: string; expires_at: string }[];

  const marking = piecesToMark(cfg, subs, pushback).filter((m) => !current.has(m.userId));
  let ready = allPiecesPassed(cfg, subs).filter((uid) => !current.has(uid));
  if (ready.length && cert.award_requires_course_id) {
    const { data: done } = await service
      .from("enrollments")
      .select("user_id")
      .eq("course_id", cert.award_requires_course_id)
      .eq("status", "completed")
      .in("user_id", ready);
    const finished = new Set((done ?? []).map((d: { user_id: string }) => d.user_id));
    ready = ready.filter((uid) => finished.has(uid));
  }

  const ids = [...new Set([...marking.map((m) => m.userId), ...ready, ...expiringRows.map((e) => e.user_id)])];
  if (ids.length === 0) return null;
  const { data: us } = await service
    .from("users")
    .select("id, first_name, last_name, email, organization_id")
    .in("id", ids);
  const people = new Map<string, Person>();
  for (const u of us ?? []) {
    people.set(u.id, {
      id: u.id,
      name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email || "A learner",
      org: u.organization_id ?? null,
    });
  }
  const who = (id: string): Person => people.get(id) ?? { id, name: "A learner", org: null };

  return {
    certName: cert.name,
    toMark: marking
      .map((m) => ({ learner: who(m.userId), piece: m.piece, days: daysWaiting(m.submittedAt, now) }))
      .sort((a, b) => b.days - a.days),
    ready: ready.map(who),
    expiring: expiringRows
      .map((e) => ({ learner: who(e.user_id), expiresAt: e.expires_at }))
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)),
  };
}

/** The part of a digest one reader may see. */
export function scopedTo(d: CertDigest, reader: { role: string; organization_id: string | null }): CertDigest {
  if (reader.role === "super_admin") return d;
  const mine = (p: Person) => !!reader.organization_id && p.org === reader.organization_id;
  return {
    certName: d.certName,
    toMark: d.toMark.filter((m) => mine(m.learner)),
    ready: d.ready.filter(mine),
    expiring: d.expiring.filter((e) => mine(e.learner)),
  };
}

const isEmpty = (d: CertDigest) => !d.toMark.length && !d.ready.length && !d.expiring.length;

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function digestText(firstName: string, digests: CertDigest[]): { subject: string; body: string } {
  const marks = digests.reduce((n, d) => n + d.toMark.length, 0);
  const ready = digests.reduce((n, d) => n + d.ready.length, 0);
  const bits = [
    marks ? `${marks} to mark` : "",
    ready ? `${ready} ready to award` : "",
  ].filter(Boolean);
  const subject = bits.length ? `Certifications: ${bits.join(", ")}` : "Certifications: renewals coming up";
  const sections = digests.map((d) => {
    const lines = [d.certName];
    for (const m of d.toMark) {
      lines.push(`• To mark: ${m.learner.name}'s ${m.piece}, waiting ${m.days === 1 ? "1 day" : `${m.days} days`}`);
    }
    for (const r of d.ready) lines.push(`• Ready to award: ${r.name}`);
    for (const e of d.expiring) lines.push(`• Expires ${shortDate(e.expiresAt)}: ${e.learner.name}`);
    return lines.join("\n");
  });
  return {
    subject,
    body: `Hi ${firstName},\n\nHere's what's waiting on the certifications you look after.\n\n${sections.join("\n\n")}`,
  };
}

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

/** Build and send this week's digests. Returns how many emails went out. */
export async function sendWeeklyDigests(service: SupabaseClient, now = new Date()): Promise<{ sent: number; records_processed: number }> {
  const { data: certs, error } = await service
    .from("certifications")
    .select("id, name, capstone_key, award_requires_course_id, notify_user_ids")
    .eq("status", "active")
    .not("capstone_key", "is", null)
    .limit(50);
  if (error) throw new Error(error.message);

  const byReader = new Map<string, CertDigest[]>();
  const readerIds = new Set<string>();
  const digests = new Map<string, CertDigest>();
  for (const c of certs ?? []) {
    const ids: string[] = c.notify_user_ids ?? [];
    if (!ids.length) continue;
    const d = await digestFor(service, c, now);
    if (!d) continue;
    digests.set(c.id, d);
    ids.forEach((id) => readerIds.add(id));
  }
  if (!readerIds.size) return { sent: 0, records_processed: 0 };

  const { data: readers } = await service
    .from("users")
    .select("id, email, first_name, role, organization_id")
    .in("id", [...readerIds]);
  const readerById = new Map((readers ?? []).map((r: any) => [r.id, r]));

  for (const c of certs ?? []) {
    const d = digests.get(c.id);
    if (!d) continue;
    for (const rid of (c.notify_user_ids ?? []) as string[]) {
      const r = readerById.get(rid) as { role: string; organization_id: string | null } | undefined;
      if (!r) continue;
      const mine = scopedTo(d, r);
      if (isEmpty(mine)) continue;
      byReader.set(rid, [...(byReader.get(rid) ?? []), mine]);
    }
  }

  let sent = 0;
  for (const [rid, list] of byReader) {
    const r = readerById.get(rid) as { email: string | null; first_name: string | null } | undefined;
    if (!r?.email) continue;
    const { subject, body } = digestText(r.first_name || "there", list);
    const tpl = customTemplate({
      subject,
      bodyText: body,
      ctaText: "Open the Award screen",
      ctaUrl: `${appUrl()}/admin/certifications`,
    });
    try {
      await sendEmail({ to: r.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
      sent += 1;
    } catch (e) {
      console.error("[certification digest] send", rid, (e as Error).message);
    }
  }
  return { sent, records_processed: sent };
}

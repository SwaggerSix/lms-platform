/**
 * Certificates running out.
 *
 * Every certificate with an expiry date gets two warnings by email — 90 days
 * before and 30 days before — and, the day after it lapses, a notice that it
 * has expired. Lapsing also flips its row to `expired` (until then a lapsed
 * row still said `active`, which counted it as current everywhere that read
 * the status alone), and for a credential the partner portal tracks it tells
 * the portal, which retires the badge and, for MOS-100, Mosaic Certified.
 *
 * Run once a day by /api/cron/certification-expiry. Which warnings a holder
 * has had is kept on the row (`expiry_reminders_sent`), so a missed day never
 * means a missed warning; a re-award clears it (issue.ts).
 *
 * Renewing: a staff-awarded credential is renewed by the assessor pressing
 * Award again (an expired holder shows up under "ready" on the Award screen);
 * a course certificate with a recertification course, by taking that course.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/sender";
import { customTemplate } from "@/lib/email/templates";
import { syncCertificationToPortal, type PortalSyncOutcome } from "@/lib/integrations/partner-portal/certification";

/** Days before expiry that the holder is warned, largest first. */
export const EXPIRY_REMINDER_DAYS = [90, 30] as const;

const DAY_MS = 86_400_000;
const BATCH = 500;

/**
 * The warning due now, or null. Only the nearest unsent tier is sent: a
 * certificate first seen 20 days out gets the 30-day warning, not both.
 */
export function reminderDue(expiresAt: string, sent: number[], now: Date): number | null {
  const daysLeft = (new Date(expiresAt).getTime() - now.getTime()) / DAY_MS;
  if (daysLeft <= 0) return null;
  const due = [...EXPIRY_REMINDER_DAYS].reverse().find((t) => daysLeft <= t);
  if (due == null || sent.includes(due)) return null;
  return due;
}

/** Tiers to record once `tier` is sent: it and every earlier (larger) one. */
export function tiersCovered(tier: number): number[] {
  return EXPIRY_REMINDER_DAYS.filter((t) => t >= tier);
}

export function wholeDaysLeft(expiresAt: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS));
}

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

interface Row {
  id: string;
  user_id: string;
  expires_at: string;
  expiry_reminders_sent: number[] | null;
  user: { email?: string | null; first_name?: string | null } | null;
  certification: {
    name?: string | null;
    course_id?: string | null;
    capstone_key?: string | null;
    notify_user_ids?: string[] | null;
    recertification_course?: { title?: string | null } | null;
  } | null;
}

const COLS =
  "id, user_id, expires_at, expiry_reminders_sent, " +
  "user:users!user_certifications_user_id_fkey(email, first_name), " +
  "certification:certifications(name, course_id, capstone_key, notify_user_ids, " +
  "recertification_course:courses!certifications_recertification_course_id_fkey(title))";

/**
 * How to renew, and who a reply reaches. A staff-awarded credential's reply
 * goes to the staff who asked to hear about its hand-ins.
 */
async function renewal(service: SupabaseClient, cert: Row["certification"]) {
  const course = cert?.recertification_course?.title;
  if (course) return { line: `To renew it, complete "${course}".`, replyTo: undefined as string | undefined };
  if (cert && !cert.course_id) {
    const ids = cert.notify_user_ids ?? [];
    if (ids.length) {
      const { data } = await service.from("users").select("email").in("id", ids).limit(5);
      const emails = (data ?? []).map((u: { email: string | null }) => u.email).filter(Boolean) as string[];
      if (emails.length) return { line: "To renew it, reply to this email.", replyTo: emails[0] };
    }
    return { line: "To renew it, contact the gothamCulture team.", replyTo: undefined };
  }
  return { line: "", replyTo: undefined };
}

async function sendReminder(service: SupabaseClient, row: Row, now: Date) {
  const email = row.user?.email;
  if (!email) return;
  const name = row.certification?.name || "your certification";
  const days = wholeDaysLeft(row.expires_at, now);
  const { line, replyTo } = await renewal(service, row.certification);
  const tpl = customTemplate({
    subject: `${name} expires in ${days} days`,
    bodyText:
      `Hi ${row.user?.first_name || "there"},\n\n` +
      `Your ${name} certification expires on ${longDate(row.expires_at)}.` +
      (line ? ` ${line}` : ""),
    ctaText: "View your certifications",
    ctaUrl: `${appUrl()}/learn/certifications`,
  });
  await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text, replyTo });
}

async function sendExpired(service: SupabaseClient, row: Row) {
  const email = row.user?.email;
  if (!email) return;
  const name = row.certification?.name || "your certification";
  const { line, replyTo } = await renewal(service, row.certification);
  const tpl = customTemplate({
    subject: `${name} has expired`,
    bodyText:
      `Hi ${row.user?.first_name || "there"},\n\n` +
      `Your ${name} certification expired on ${longDate(row.expires_at)}.` +
      (line ? ` ${line}` : ""),
    ctaText: "View your certifications",
    ctaUrl: `${appUrl()}/learn/certifications`,
  });
  await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text, replyTo });
}

export interface ExpirySweepResult {
  expired: number;
  reminded: number;
  portal: Partial<Record<PortalSyncOutcome, number>>;
  errors: number;
  records_processed: number;
}

/** Expire what has lapsed, then send the warnings that are due. */
export async function runExpirySweep(service: SupabaseClient, now = new Date()): Promise<ExpirySweepResult> {
  const out: ExpirySweepResult = { expired: 0, reminded: 0, portal: {}, errors: 0, records_processed: 0 };
  const nowIso = now.toISOString();

  // 1. Lapsed: still marked active, past its date.
  const { data: lapsed, error: lapsedError } = await service
    .from("user_certifications")
    .select(COLS)
    .eq("status", "active")
    .lte("expires_at", nowIso)
    .limit(BATCH);
  if (lapsedError) throw new Error(lapsedError.message);
  for (const row of (lapsed ?? []) as unknown as Row[]) {
    try {
      // Conditional on still being active, so a run racing a re-award or a
      // second run never expires a fresh certificate or emails twice.
      const { data: flipped, error } = await service
        .from("user_certifications")
        .update({ status: "expired" })
        .eq("id", row.id)
        .eq("status", "active")
        .lte("expires_at", nowIso)
        .select("id");
      if (error) throw new Error(error.message);
      if (!flipped || flipped.length === 0) continue;
      out.expired += 1;
      await sendExpired(service, row).catch((e) => console.error("[cert expiry] expired email:", e));
      if (row.certification?.capstone_key) {
        const outcome = await syncCertificationToPortal(service, row.id, "expire");
        out.portal[outcome] = (out.portal[outcome] ?? 0) + 1;
      }
    } catch (e) {
      out.errors += 1;
      console.error("[cert expiry] expire", row.id, (e as Error).message);
    }
  }

  // 2. Warnings: active, expiring within the largest tier.
  const horizon = new Date(now.getTime() + EXPIRY_REMINDER_DAYS[0] * DAY_MS).toISOString();
  const { data: soon, error: soonError } = await service
    .from("user_certifications")
    .select(COLS)
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .lte("expires_at", horizon)
    .limit(BATCH * 2);
  if (soonError) throw new Error(soonError.message);
  for (const row of (soon ?? []) as unknown as Row[]) {
    const sent = row.expiry_reminders_sent ?? [];
    const tier = reminderDue(row.expires_at, sent, now);
    if (tier == null) continue;
    try {
      // Record first (conditional on the list being unchanged), then send:
      // a failed send costs one warning, never a duplicate.
      const next = [...new Set([...sent, ...tiersCovered(tier)])].sort((a, b) => b - a);
      const { data: marked, error } = await service
        .from("user_certifications")
        .update({ expiry_reminders_sent: next })
        .eq("id", row.id)
        .eq("status", "active")
        .eq("expiry_reminders_sent", `{${sent.join(",")}}`)
        .select("id");
      if (error) throw new Error(error.message);
      if (!marked || marked.length === 0) continue;
      await sendReminder(service, row, now);
      out.reminded += 1;
    } catch (e) {
      out.errors += 1;
      console.error("[cert expiry] remind", row.id, (e as Error).message);
    }
  }

  out.records_processed = out.expired + out.reminded;
  return out;
}

/**
 * Issuing certificates.
 *
 * Two kinds live in `certifications`:
 *
 * - **Course-completion certificates** have `course_id` set. Finishing that
 *   course (every lesson complete; for a Mosaic course, the final exam passed)
 *   issues them automatically — `issueCourseCompletionCertificates`.
 * - **Staff-awarded credentials** have no `course_id`, so nothing issues them
 *   automatically. Mosaic Practitioner Certified is one: finishing MOS-100,
 *   MOS-230 and MOS-240 is not enough, the assessor must also pass every
 *   piece of the capstone, then press Award — `awardCertification`.
 *   `award_requires_course_id(s)` name the course(s) the learner must have
 *   finished first (requirements.ts).
 *
 * One row per learner per certification (unique index); re-awarding after a
 * revoke reactivates that row.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { capstoneFor, listOf, passDates, type SubmissionLike } from "./capstone";
import { hasFinishedAll, requiredCourseIds } from "./requirements";

/** `expires_at` for a certificate issued at `issuedAt`, or null if it never expires. */
export function expiryFor(validityMonths: number | null | undefined, issuedAt: Date): string | null {
  if (!validityMonths || validityMonths <= 0) return null;
  const d = new Date(issuedAt.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + validityMonths);
  // Clamp to the month's last day (e.g. Feb 29 + 12 months → Feb 28).
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}

/**
 * Issue every active course-completion certificate linked to `courseId`.
 * A learner who already holds one keeps the original (the issue date is the
 * first completion). Returns the ids of certifications newly issued.
 */
export async function issueCourseCompletionCertificates(
  service: SupabaseClient,
  args: { userId: string; courseId: string; metadata?: Record<string, unknown>; now?: Date }
): Promise<string[]> {
  const now = args.now ?? new Date();
  const { data: certs, error } = await service
    .from("certifications")
    .select("id, validity_months")
    .eq("course_id", args.courseId)
    .eq("status", "active")
    .limit(20);
  if (error || !certs || certs.length === 0) return [];

  const rows = certs.map((c: { id: string; validity_months: number | null }) => ({
    user_id: args.userId,
    certification_id: c.id,
    issued_at: now.toISOString(),
    expires_at: expiryFor(c.validity_months, now),
    status: "active",
    metadata: { ...(args.metadata ?? {}), issued_by: "course_completion", course_id: args.courseId },
  }));

  const { data: inserted, error: insertError } = await service
    .from("user_certifications")
    .upsert(rows, { onConflict: "user_id,certification_id", ignoreDuplicates: true })
    .select("certification_id");
  if (insertError) {
    console.error("Certificate issue error:", insertError.message);
    return [];
  }
  return (inserted ?? []).map((r: { certification_id: string }) => r.certification_id);
}

export type AwardResult =
  | { ok: true; userCertificationId: string; reawarded: boolean }
  | { ok: false; status: number; error: string };

/**
 * Award a staff-awarded credential (e.g. Mosaic Certified) to a learner.
 * Refuses a course-completion certificate (those come from finishing the
 * course), an inactive one, and a learner who hasn't completed the required
 * course.
 */
export async function awardCertification(
  service: SupabaseClient,
  args: {
    certificationId: string;
    userId: string;
    awardedBy: string;
    /** Ignored for a credential with a capstone: the marked hand-ins give the dates. */
    memoPassedOn?: string;
    briefingPassedOn?: string;
    note?: string;
    now?: Date;
  }
): Promise<AwardResult> {
  const now = args.now ?? new Date();

  const { data: cert } = await service
    .from("certifications")
    .select("id, name, course_id, status, validity_months, award_requires_course_id, award_requires_course_ids, capstone_key")
    .eq("id", args.certificationId)
    .maybeSingle();
  if (!cert) return { ok: false, status: 404, error: "Certification not found" };
  if (cert.course_id) {
    return {
      ok: false,
      status: 400,
      error: "This certificate is issued automatically when the course is completed; it can't be awarded by hand.",
    };
  }
  if (cert.status !== "active") return { ok: false, status: 400, error: "This certification is inactive." };

  const { data: learner } = await service
    .from("users")
    .select("id")
    .eq("id", args.userId)
    .maybeSingle();
  if (!learner) return { ok: false, status: 404, error: "Learner not found" };

  if (requiredCourseIds(cert).length && !(await hasFinishedAll(service, cert, args.userId))) {
    return {
      ok: false,
      status: 409,
      error:
        requiredCourseIds(cert).length > 1
          ? "This learner hasn't finished all the required courses (final exams passed) yet."
          : "This learner hasn't completed the required course (final exam passed) yet.",
    };
  }

  // Dates each piece of work passed, by kind (memo / briefing / practical).
  let piecesPassedOn: Record<string, string>;
  const cfg = capstoneFor(cert.capstone_key);
  if (cfg) {
    const { data: subs } = await service
      .from("certification_submissions")
      .select("kind, attempt, status, reviewed_at")
      .eq("user_id", args.userId)
      .eq("certification_id", cert.id);
    const dates = passDates((subs ?? []) as SubmissionLike[], cfg.pieces.map((p) => p.kind));
    if (!dates) {
      // Name only the pieces still to pass.
      const todo = cfg.pieces.filter((p) => !passDates((subs ?? []) as SubmissionLike[], [p.kind])).map((p) => p.noun);
      return { ok: false, status: 409, error: `Mark this learner's ${listOf(todo)} as passed first.` };
    }
    piecesPassedOn = dates;
  } else if (args.memoPassedOn && args.briefingPassedOn) {
    piecesPassedOn = { memo: args.memoPassedOn, briefing: args.briefingPassedOn };
  } else {
    return { ok: false, status: 400, error: "Enter the dates the memo and briefing passed." };
  }

  const metadata = {
    issued_by: "staff_award",
    awarded_by: args.awardedBy,
    pieces_passed_on: piecesPassedOn,
    ...(piecesPassedOn.memo ? { memo_passed_on: piecesPassedOn.memo } : {}),
    ...(piecesPassedOn.briefing ? { briefing_passed_on: piecesPassedOn.briefing } : {}),
    ...(args.note ? { note: args.note } : {}),
  };

  const { data: existing } = await service
    .from("user_certifications")
    .select("id, status")
    .eq("user_id", args.userId)
    .eq("certification_id", cert.id)
    .maybeSingle();

  if (existing && existing.status === "active") {
    return { ok: false, status: 409, error: "This learner already holds this certification." };
  }

  const fields = {
    issued_at: now.toISOString(),
    expires_at: expiryFor(cert.validity_months, now),
    status: "active",
    metadata,
    // A renewal starts the expiry warnings over (expiry.ts).
    expiry_reminders_sent: [] as number[],
  };

  if (existing) {
    const { error } = await service.from("user_certifications").update(fields).eq("id", existing.id);
    if (error) {
      console.error("Certificate award error:", error.message);
      return { ok: false, status: 500, error: "Internal server error" };
    }
    return { ok: true, userCertificationId: existing.id, reawarded: true };
  }

  const { data: row, error } = await service
    .from("user_certifications")
    .insert({ user_id: args.userId, certification_id: cert.id, ...fields })
    .select("id")
    .single();
  if (error || !row) {
    console.error("Certificate award error:", error?.message);
    return { ok: false, status: 500, error: "Internal server error" };
  }
  return { ok: true, userCertificationId: row.id, reawarded: false };
}

/** Revoke a held certification. The row stays, marked revoked, for the record. */
export async function revokeCertification(
  service: SupabaseClient,
  args: { userCertificationId: string; revokedBy: string; reason?: string; now?: Date }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const now = args.now ?? new Date();
  const { data: row } = await service
    .from("user_certifications")
    .select("id, status, metadata")
    .eq("id", args.userCertificationId)
    .maybeSingle();
  if (!row) return { ok: false, status: 404, error: "Not found" };
  if (row.status === "revoked") return { ok: true };
  const { error } = await service
    .from("user_certifications")
    .update({
      status: "revoked",
      metadata: {
        ...((row.metadata as Record<string, unknown>) ?? {}),
        revoked_by: args.revokedBy,
        revoked_at: now.toISOString(),
        ...(args.reason ? { revoke_reason: args.reason } : {}),
      },
    })
    .eq("id", row.id);
  if (error) {
    console.error("Certificate revoke error:", error.message);
    return { ok: false, status: 500, error: "Internal server error" };
  }
  return { ok: true };
}

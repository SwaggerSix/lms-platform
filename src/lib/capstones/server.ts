import { createServiceClient } from "@/lib/supabase/service";
import { generateVerificationCode } from "@/lib/certificates/renderer";
import { sendEmail } from "@/lib/email/sender";
import { capstoneOpen } from "@/lib/email/templates";
import { addMonths, type CapstoneAttempt } from "./rules";

type Service = ReturnType<typeof createServiceClient>;

/** The certification columns the capstone flow reads. */
export const CAPSTONE_CERT_COLUMNS =
  "id, name, description, learning_path_id, requires_capstone, capstone_instructions, max_capstone_attempts, validity_months, portal_certification";

export interface CapstoneCertification {
  id: string;
  name: string;
  description: string | null;
  learning_path_id: string | null;
  requires_capstone: boolean;
  capstone_instructions: string | null;
  max_capstone_attempts: number;
  validity_months: number | null;
  portal_certification: string | null;
}

export interface CapstoneSubmissionRow extends CapstoneAttempt {
  id: string;
  certification_id: string;
  user_id: string;
  files: { path: string; name: string; size: number; type: string }[];
  links: { label: string; url: string }[];
  learner_note: string | null;
  submitted_at: string;
  graded_by: string | null;
  graded_at: string | null;
  feedback: string | null;
  user_certification_id: string | null;
}

/** The app's public origin, for links in emails and certificates. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://learn.gothamculture.com").replace(/\/+$/, "");
}

export function capstonePageUrl(certificationId: string): string {
  return `${appUrl()}/learn/capstone/${certificationId}`;
}

/** Who marks capstones and gets "ready to mark" emails. */
export function assessorEmail(): string | null {
  return process.env.CAPSTONE_ASSESSOR_EMAIL?.trim() || null;
}

export function assessorName(): string {
  return process.env.CAPSTONE_ASSESSOR_NAME?.trim() || "Dr. Chris Cancialosi";
}

export async function loadCapstoneCertification(
  service: Service,
  certificationId: string
): Promise<CapstoneCertification | null> {
  const { data } = await service
    .from("certifications")
    .select(CAPSTONE_CERT_COLUMNS)
    .eq("id", certificationId)
    .maybeSingle();
  return (data as CapstoneCertification | null) ?? null;
}

/**
 * Whether the learner has completed every required course on the path (all
 * of them when none is marked required). An empty path is never complete.
 */
export async function pathCompletion(
  service: Service,
  userId: string,
  pathId: string
): Promise<{ complete: boolean; total: number; done: number }> {
  const { data: items } = await service
    .from("learning_path_items")
    .select("course_id, is_required")
    .eq("path_id", pathId);
  const all = (items ?? []) as { course_id: string; is_required: boolean | null }[];
  const required = all.filter((i) => i.is_required !== false);
  const courseIds = (required.length > 0 ? required : all).map((i) => i.course_id);
  if (courseIds.length === 0) return { complete: false, total: 0, done: 0 };

  const { data: enrollments } = await service
    .from("enrollments")
    .select("course_id, status")
    .eq("user_id", userId)
    .in("course_id", courseIds);
  const completed = new Set(
    ((enrollments ?? []) as { course_id: string; status: string }[])
      .filter((e) => e.status === "completed")
      .map((e) => e.course_id)
  );
  const done = courseIds.filter((id) => completed.has(id)).length;
  return { complete: done === courseIds.length, total: courseIds.length, done };
}

export async function loadAttempts(
  service: Service,
  userId: string,
  certificationId: string
): Promise<CapstoneSubmissionRow[]> {
  const { data } = await service
    .from("capstone_submissions")
    .select("*")
    .eq("user_id", userId)
    .eq("certification_id", certificationId)
    .order("attempt", { ascending: true });
  return (data ?? []) as CapstoneSubmissionRow[];
}

/**
 * Issues a certificate: a user_certifications row with its verification code
 * and public link, expiring after the certification's validity (none when
 * validity_months is null).
 */
export async function issueCertification(
  service: Service,
  params: { userId: string; certification: Pick<CapstoneCertification, "id" | "validity_months">; metadata?: Record<string, unknown> }
): Promise<{ id: string; verification_code: string; public_url: string; issued_at: string; expires_at: string | null }> {
  let code = generateVerificationCode();
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await service
      .from("user_certifications")
      .select("id")
      .eq("verification_code", code)
      .maybeSingle();
    if (!clash) break;
    code = generateVerificationCode();
  }
  const issued = new Date();
  const expires = params.certification.validity_months
    ? addMonths(issued, params.certification.validity_months)
    : null;
  const publicUrl = `${appUrl()}/verify/${code}`;

  const { data, error } = await service
    .from("user_certifications")
    .insert({
      user_id: params.userId,
      certification_id: params.certification.id,
      issued_at: issued.toISOString(),
      expires_at: expires ? expires.toISOString() : null,
      status: "active",
      verification_code: code,
      public_url: publicUrl,
      metadata: params.metadata ?? {},
    })
    .select("id, verification_code, public_url, issued_at, expires_at")
    .single();
  if (error || !data) throw new Error(`issueCertification failed: ${error?.message ?? "no row"}`);
  return data as { id: string; verification_code: string; public_url: string; issued_at: string; expires_at: string | null };
}

/**
 * Called once a course enrollment has just been completed. For every
 * certification whose learning path includes that course and is now fully
 * completed by this learner:
 *   - the learner's path enrollment (if any) is marked completed;
 *   - a capstone-gated certification emails the learner that the capstone
 *     is open (and notifies them in the app);
 *   - any other certification is issued straight away (once).
 *
 * Never throws: a failure here must not undo the course completion.
 */
export async function onCourseCompleted(service: Service, userId: string, courseId: string): Promise<void> {
  try {
    const { data: items } = await service
      .from("learning_path_items")
      .select("path_id")
      .eq("course_id", courseId);
    const pathIds = Array.from(new Set(((items ?? []) as { path_id: string }[]).map((i) => i.path_id)));
    if (pathIds.length === 0) return;

    const { data: certs } = await service
      .from("certifications")
      .select(CAPSTONE_CERT_COLUMNS)
      .in("learning_path_id", pathIds);
    const certifications = (certs ?? []) as CapstoneCertification[];

    for (const pathId of pathIds) {
      const progress = await pathCompletion(service, userId, pathId);
      if (!progress.complete) continue;

      await service
        .from("learning_path_enrollments")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("path_id", pathId)
        .neq("status", "completed");

      for (const cert of certifications.filter((c) => c.learning_path_id === pathId)) {
        if (cert.requires_capstone) {
          await announceCapstoneOpen(service, userId, cert);
        } else {
          const { data: existing } = await service
            .from("user_certifications")
            .select("id")
            .eq("user_id", userId)
            .eq("certification_id", cert.id)
            .eq("status", "active")
            .limit(1);
          if (!existing || existing.length === 0) {
            await issueCertification(service, { userId, certification: cert, metadata: { source: "path_completion", path_id: pathId } });
          }
        }
      }
    }
  } catch (err) {
    console.error("[capstones] onCourseCompleted failed:", err instanceof Error ? err.message : err);
  }
}

/** Email + in-app notice that the capstone is open, unless they've started it. */
async function announceCapstoneOpen(service: Service, userId: string, cert: CapstoneCertification): Promise<void> {
  const { data: prior } = await service
    .from("capstone_submissions")
    .select("id")
    .eq("user_id", userId)
    .eq("certification_id", cert.id)
    .limit(1);
  if (prior && prior.length > 0) return;

  const { data: user } = await service
    .from("users")
    .select("email, first_name, last_name")
    .eq("id", userId)
    .maybeSingle();
  const url = capstonePageUrl(cert.id);

  await service.from("notifications").insert({
    user_id: userId,
    type: "certification",
    channel: "in_app",
    title: `Your ${cert.name} capstone is open`,
    body: "You've finished every course. The last step is the capstone.",
    link: `/learn/capstone/${cert.id}`,
    is_read: false,
  });

  if (user?.email) {
    const t = capstoneOpen({
      learnerName: user.first_name || "there",
      certName: cert.name,
      capstoneUrl: url,
    });
    const sent = await sendEmail({ to: user.email, subject: t.subject, html: t.html, text: t.text });
    if (!sent.success) console.error("[capstones] capstone-open email failed:", sent.error);
  }
}

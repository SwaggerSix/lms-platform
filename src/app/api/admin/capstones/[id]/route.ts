import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/sender";
import {
  capstoneAnotherAttempt,
  capstoneNeedsCall,
  capstonePassed,
  capstoneResubmit,
} from "@/lib/email/templates";
import { isFinalAllowedAttempt } from "@/lib/capstones/rules";
import {
  appUrl,
  assessorEmail,
  assessorName,
  capstonePageUrl,
  issueCertification,
  loadCapstoneCertification,
} from "@/lib/capstones/server";
import { syncCertificationToPortal } from "@/lib/capstones/portal";

type Params = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pass"), feedback: z.string().trim().max(10000).optional() }),
  z.object({ action: z.literal("not_yet"), feedback: z.string().trim().min(20, "Write the feedback the learner will get (at least a couple of sentences).").max(10000) }),
  z.object({ action: z.literal("allow_attempt") }),
  z.object({ action: z.literal("retry_portal") }),
]);

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * PATCH /api/admin/capstones/[id]  (admin)
 *
 *   { action: "pass", feedback? }      issue the certificate, email the learner,
 *                                      tell the partner portal (invite + badge)
 *   { action: "not_yet", feedback }    return feedback; with an attempt left the
 *                                      learner may resubmit, otherwise they're
 *                                      told the assessor will set up a call
 *   { action: "allow_attempt" }        after that call: one more attempt
 *   { action: "retry_portal" }         resend a passed one to the portal
 *
 * Marking only moves a submission that is still waiting ("submitted"); the
 * update is conditional on that, so two admins can't both mark it.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return NextResponse.json({ error: message && message.length < 200 ? message : "Invalid request" }, { status: 400 });
  }
  const input = parsed.data;

  const service = createServiceClient();
  const { data: submission } = await service
    .from("capstone_submissions")
    .select("id, certification_id, user_id, attempt, status, another_attempt_allowed, user_certification_id")
    .eq("id", id)
    .maybeSingle();
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const certification = await loadCapstoneCertification(service, submission.certification_id);
  if (!certification) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: learner } = await service
    .from("users")
    .select("email, first_name")
    .eq("id", submission.user_id)
    .maybeSingle();
  const firstName = learner?.first_name || "there";
  const replyTo = assessorEmail() ?? undefined;
  const now = new Date().toISOString();

  if (input.action === "retry_portal") {
    if (submission.status !== "passed" || !submission.user_certification_id) {
      return NextResponse.json({ error: "Only a passed capstone has a certificate to send." }, { status: 409 });
    }
    const portal = await syncCertificationToPortal(service, submission.user_certification_id);
    return NextResponse.json({ portal });
  }

  if (input.action === "allow_attempt") {
    const { data: latest } = await service
      .from("capstone_submissions")
      .select("id")
      .eq("certification_id", submission.certification_id)
      .eq("user_id", submission.user_id)
      .order("attempt", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      latest?.id !== submission.id ||
      submission.status !== "not_yet" ||
      submission.another_attempt_allowed ||
      !isFinalAllowedAttempt(submission.attempt, certification.max_capstone_attempts)
    ) {
      return NextResponse.json({ error: "There's no call-stage attempt to reopen here." }, { status: 409 });
    }
    await service
      .from("capstone_submissions")
      .update({ another_attempt_allowed: true, updated_at: now })
      .eq("id", submission.id);
    if (learner?.email) {
      const t = capstoneAnotherAttempt({ learnerName: firstName, certName: certification.name, capstoneUrl: capstonePageUrl(certification.id) });
      await sendEmail({ to: learner.email, subject: t.subject, html: t.html, text: t.text, replyTo });
    }
    return NextResponse.json({ ok: true });
  }

  // pass / not_yet: claim the waiting submission.
  const { data: claimed } = await service
    .from("capstone_submissions")
    .update({
      status: input.action === "pass" ? "passed" : "not_yet",
      graded_by: auth.user.id,
      graded_at: now,
      feedback: input.feedback || null,
      updated_at: now,
    })
    .eq("id", submission.id)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json({ error: "This submission has already been marked." }, { status: 409 });
  }

  if (input.action === "not_yet") {
    const final = isFinalAllowedAttempt(submission.attempt, certification.max_capstone_attempts);
    if (learner?.email) {
      const t = final
        ? capstoneNeedsCall({ learnerName: firstName, certName: certification.name, feedback: input.feedback, assessorName: assessorName() })
        : capstoneResubmit({ learnerName: firstName, certName: certification.name, feedback: input.feedback, capstoneUrl: capstonePageUrl(certification.id) });
      const sent = await sendEmail({ to: learner.email, subject: t.subject, html: t.html, text: t.text, replyTo });
      if (!sent.success) console.error("[capstones] not-yet email failed:", sent.error);
    }
    return NextResponse.json({ ok: true, needs_call: final });
  }

  // pass
  let cert;
  try {
    cert = await issueCertification(service, {
      userId: submission.user_id,
      certification,
      metadata: { source: "capstone", submission_id: submission.id, attempt: submission.attempt },
    });
  } catch (err) {
    // Put it back in the queue so the pass can be retried.
    await service
      .from("capstone_submissions")
      .update({ status: "submitted", graded_by: null, graded_at: null, feedback: null, updated_at: new Date().toISOString() })
      .eq("id", submission.id);
    console.error("[capstones] certificate issue failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "The certificate couldn't be issued. Nothing was sent; try again." }, { status: 500 });
  }
  await service
    .from("capstone_submissions")
    .update({ user_certification_id: cert.id })
    .eq("id", submission.id);

  await service.from("notifications").insert({
    user_id: submission.user_id,
    type: "certification",
    channel: "in_app",
    title: `You're certified: ${certification.name}`,
    body: "You passed the capstone. Your certificate is ready.",
    link: "/learn/certifications",
    is_read: false,
  });
  if (learner?.email) {
    const t = capstonePassed({
      learnerName: firstName,
      certName: certification.name,
      expiresOn: cert.expires_at ? longDate(cert.expires_at) : "no expiry",
      verifyUrl: cert.public_url,
      certificatesUrl: `${appUrl()}/learn/certifications`,
      feedback: input.feedback || null,
    });
    const sent = await sendEmail({ to: learner.email, subject: t.subject, html: t.html, text: t.text, replyTo });
    if (!sent.success) console.error("[capstones] passed email failed:", sent.error);
  }
  const portal = await syncCertificationToPortal(service, cert.id);
  return NextResponse.json({ ok: true, certificate: cert, portal });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/sender";
import { capstoneReceived, capstoneSubmittedToAssessor } from "@/lib/email/templates";
import { learnerCapstoneContext } from "@/lib/capstones/context";
import { appUrl, assessorEmail, capstonePageUrl } from "@/lib/capstones/server";
import {
  CAPSTONE_BUCKET,
  MARKING_BUSINESS_DAYS,
  MAX_CAPSTONE_FILES,
  MAX_CAPSTONE_LINKS,
  addBusinessDays,
  capstoneContentType,
  capstonePrefix,
  isAcceptableLink,
  isOwnCapstonePath,
} from "@/lib/capstones/rules";

type Params = { params: Promise<{ certificationId: string }> };

const Body = z.object({
  files: z
    .array(z.object({ path: z.string().min(1).max(500), name: z.string().min(1).max(255) }))
    .max(MAX_CAPSTONE_FILES)
    .default([]),
  links: z
    .array(z.object({ label: z.string().trim().min(1).max(120), url: z.string().trim().min(1).max(2000) }))
    .max(MAX_CAPSTONE_LINKS)
    .default([]),
  note: z.string().trim().max(5000).optional(),
});

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * POST /api/capstones/[certificationId]/submissions  { files, links, note }
 *
 * Submits the next attempt. Only when the capstone is open for the learner
 * (path complete, nothing waiting to be marked, an attempt left). Files must
 * be ones they uploaded to their own folder for this certification; links
 * must be https. The learner gets a receipt with the date to expect their
 * result by, and the assessor (CAPSTONE_ASSESSOR_EMAIL) a "ready to mark".
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { certificationId } = await params;
  const ctx = await learnerCapstoneContext(certificationId);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.state.kind !== "open") {
    return NextResponse.json({ error: "Your capstone isn't open for a submission right now." }, { status: 409 });
  }

  const rl = await rateLimit(`capstone-submit-${ctx.userId}`, 5, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { files, links, note } = parsed.data;

  if (files.length === 0 && links.length === 0) {
    return NextResponse.json({ error: "Add at least one file or link." }, { status: 400 });
  }
  for (const l of links) {
    if (!isAcceptableLink(l.url)) {
      return NextResponse.json({ error: `"${l.label}" needs a full link starting with https://` }, { status: 400 });
    }
  }
  for (const f of files) {
    if (!isOwnCapstonePath(f.path, ctx.userId, ctx.certification.id)) {
      return NextResponse.json({ error: "One of the files wasn't uploaded here. Upload it again." }, { status: 400 });
    }
  }

  // Every named file must actually be in storage (an upload can fail after
  // the URL was issued).
  const prefix = capstonePrefix(ctx.userId, ctx.certification.id);
  const { data: listed, error: listError } = await ctx.service.storage
    .from(CAPSTONE_BUCKET)
    .list(prefix.replace(/\/$/, ""), { limit: 1000 });
  if (listError) {
    console.error("[capstones] storage list failed:", listError.message);
    return NextResponse.json({ error: "Could not check your files. Try again." }, { status: 500 });
  }
  const stored = new Map((listed ?? []).map((o) => [o.name, o]));
  const fileRows = [];
  for (const f of files) {
    const object = stored.get(f.path.slice(prefix.length));
    if (!object) {
      return NextResponse.json({ error: `"${f.name}" didn't finish uploading. Upload it again.` }, { status: 400 });
    }
    fileRows.push({
      path: f.path,
      name: f.name,
      size: Number((object.metadata as { size?: number } | null)?.size ?? 0),
      type: capstoneContentType(f.name) ?? "application/octet-stream",
    });
  }

  const attempt = ctx.state.nextAttempt;
  const { data: row, error } = await ctx.service
    .from("capstone_submissions")
    .insert({
      certification_id: ctx.certification.id,
      user_id: ctx.userId,
      attempt,
      status: "submitted",
      files: fileRows,
      links,
      learner_note: note || null,
    })
    .select("id, attempt, submitted_at")
    .single();
  if (error || !row) {
    // 23505: a double click raced this one in.
    if (error?.code === "23505") {
      return NextResponse.json({ error: "This attempt has already been submitted." }, { status: 409 });
    }
    console.error("[capstones] submission insert failed:", error?.message);
    return NextResponse.json({ error: "Could not submit. Try again." }, { status: 500 });
  }

  const markBy = formatDate(addBusinessDays(new Date(row.submitted_at), MARKING_BUSINESS_DAYS));
  const { data: learner } = await ctx.service
    .from("users")
    .select("email, first_name, last_name")
    .eq("id", ctx.userId)
    .maybeSingle();
  const learnerName = [learner?.first_name, learner?.last_name].filter(Boolean).join(" ") || learner?.email || "A learner";

  if (learner?.email) {
    const t = capstoneReceived({
      learnerName: learner.first_name || "there",
      certName: ctx.certification.name,
      attempt,
      markBy,
      capstoneUrl: capstonePageUrl(ctx.certification.id),
    });
    const sent = await sendEmail({ to: learner.email, subject: t.subject, html: t.html, text: t.text });
    if (!sent.success) console.error("[capstones] receipt email failed:", sent.error);
  }
  const assessor = assessorEmail();
  if (assessor) {
    const t = capstoneSubmittedToAssessor({
      learnerName,
      learnerEmail: learner?.email ?? "",
      certName: ctx.certification.name,
      attempt,
      markBy,
      queueUrl: `${appUrl()}/admin/capstones`,
    });
    const sent = await sendEmail({ to: assessor, subject: t.subject, html: t.html, text: t.text, replyTo: learner?.email ?? undefined });
    if (!sent.success) console.error("[capstones] assessor email failed:", sent.error);
  }

  return NextResponse.json({ id: row.id, attempt: row.attempt, mark_by: markBy }, { status: 201 });
}

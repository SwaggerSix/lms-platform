/**
 * Database work for the capstone hand-in (rules and content: capstone.ts).
 * Every function takes the service client; callers have already checked who
 * is asking (learner: their own work; admin: in scope).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/sender";
import { customTemplate } from "@/lib/email/templates";
import {
  ALLOWED_TYPES,
  CAPSTONE_BUCKET,
  MAX_FILE_BYTES,
  allowedDecisions,
  capstoneFor,
  drawPrompts,
  isAcceptableLink,
  nextAttempt,
  type CapstoneConfig,
  type CapstoneKind,
  type SubmissionStatus,
} from "./capstone";

export interface CapstoneCert {
  id: string;
  name: string;
  status: string;
  course_id: string | null;
  award_requires_course_id: string | null;
  capstone_key: string | null;
  notify_user_ids: string[] | null;
}

type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

export async function loadCapstoneCert(
  service: SupabaseClient,
  certificationId: string
): Promise<{ cert: CapstoneCert; cfg: CapstoneConfig } | null> {
  const { data: cert } = await service
    .from("certifications")
    .select("id, name, status, course_id, award_requires_course_id, capstone_key, notify_user_ids")
    .eq("id", certificationId)
    .maybeSingle();
  const cfg = capstoneFor(cert?.capstone_key);
  if (!cert || !cfg || cert.course_id || cert.status !== "active") return null;
  return { cert: cert as CapstoneCert, cfg };
}

/** A learner may hand in work once enrolled in the course the credential requires. */
export async function learnerMayUse(service: SupabaseClient, userId: string, cert: CapstoneCert): Promise<boolean> {
  if (!cert.award_requires_course_id) return true;
  const { data } = await service
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", cert.award_requires_course_id)
    .limit(1);
  return !!data && data.length > 0;
}

export interface SubmissionRow {
  id: string;
  user_id: string;
  kind: CapstoneKind;
  attempt: number;
  status: SubmissionStatus;
  file_path: string | null;
  file_name: string | null;
  link_url: string | null;
  learner_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  feedback: string | null;
}

export interface PushbackRow {
  id: string;
  submission_id: string;
  position: number;
  prompt_index: number;
  revealed_at: string | null;
  answered_at: string | null;
  file_path: string | null;
  recorded_in_browser: boolean;
}

const SUB_COLS =
  "id, user_id, kind, attempt, status, file_path, file_name, link_url, learner_note, submitted_at, reviewed_at, feedback";
const PB_COLS = "id, submission_id, position, prompt_index, revealed_at, answered_at, file_path, recorded_in_browser";

export async function submissionsFor(
  service: SupabaseClient,
  certificationId: string,
  userIds?: string[]
): Promise<{ subs: SubmissionRow[]; pushback: PushbackRow[] }> {
  let q = service.from("certification_submissions").select(SUB_COLS).eq("certification_id", certificationId);
  if (userIds) q = q.in("user_id", userIds);
  const { data: subs, error } = await q.order("submitted_at", { ascending: true }).limit(2000);
  if (error) throw new Error(error.message);
  const briefingIds = (subs ?? []).filter((s: SubmissionRow) => s.kind === "briefing").map((s: SubmissionRow) => s.id);
  let pushback: PushbackRow[] = [];
  if (briefingIds.length) {
    const { data, error: pe } = await service
      .from("certification_pushback_answers")
      .select(PB_COLS)
      .in("submission_id", briefingIds)
      .order("position", { ascending: true });
    if (pe) throw new Error(pe.message);
    pushback = (data ?? []) as PushbackRow[];
  }
  return { subs: (subs ?? []) as SubmissionRow[], pushback };
}

// ---------------------------------------------------------------- uploads

export type UploadSlot = "memo" | "briefing" | "pushback";

export function folderFor(userId: string, certificationId: string) {
  return `${userId}/${certificationId}`;
}

export async function startUpload(
  service: SupabaseClient,
  args: { userId: string; certificationId: string; slot: UploadSlot; fileSize: number; contentType: string }
): Promise<{ ok: true; path: string; signedUrl: string } | Fail> {
  const ext = ALLOWED_TYPES[args.slot][args.contentType.split(";")[0].trim().toLowerCase()];
  if (!ext) {
    return fail(
      400,
      args.slot === "memo" ? "Upload a PDF or Word (.docx) document." : "Upload an MP4, WebM or MOV video."
    );
  }
  if (!(args.fileSize > 0) || args.fileSize > MAX_FILE_BYTES) {
    return fail(
      400,
      args.slot === "briefing"
        ? "That video is over 50 MB. Paste a link to the recording instead (Loom, unlisted YouTube, Drive or OneDrive)."
        : "That file is over 50 MB."
    );
  }
  const path = `${folderFor(args.userId, args.certificationId)}/${args.slot}-${crypto.randomUUID()}.${ext}`;
  const { data, error } = await service.storage.from(CAPSTONE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("Capstone upload URL error:", error?.message);
    return fail(500, "Could not start the upload.");
  }
  return { ok: true, path: data.path, signedUrl: data.signedUrl };
}

/** The path is in this learner's folder for this credential and the file is really there. */
export async function uploadedFileExists(
  service: SupabaseClient,
  args: { userId: string; certificationId: string; path: string }
): Promise<boolean> {
  const folder = folderFor(args.userId, args.certificationId);
  if (!args.path.startsWith(folder + "/") || args.path.includes("..")) return false;
  const name = args.path.slice(folder.length + 1);
  if (name.includes("/")) return false;
  const { data } = await service.storage.from(CAPSTONE_BUCKET).list(folder, { search: name, limit: 5 });
  return !!data?.some((f) => f.name === name);
}

export async function signedFileUrl(service: SupabaseClient, path: string, downloadName?: string) {
  const { data, error } = await service.storage
    .from(CAPSTONE_BUCKET)
    .createSignedUrl(path, 600, downloadName ? { download: downloadName } : undefined);
  if (error || !data) return null;
  return data.signedUrl;
}

// ---------------------------------------------------------------- hand in

export async function submitPiece(
  service: SupabaseClient,
  args: {
    userId: string;
    cert: CapstoneCert;
    cfg: CapstoneConfig;
    kind: CapstoneKind;
    filePath?: string;
    fileName?: string;
    link?: string;
    note?: string;
    rand?: () => number;
  }
): Promise<{ ok: true; submissionId: string; attempt: number } | Fail> {
  const { subs } = await submissionsFor(service, args.cert.id, [args.userId]);
  const attempt = nextAttempt(subs, args.kind);
  if (attempt == null) {
    const last = subs.filter((s) => s.kind === args.kind).sort((a, b) => b.attempt - a.attempt)[0];
    return fail(
      409,
      last?.status === "submitted"
        ? "You've already handed this in. Your assessor will reply soon."
        : last?.status === "passed"
          ? "This piece has already passed."
          : "No more attempts are available for this piece."
    );
  }

  if (args.kind === "memo" && !args.filePath) return fail(400, "Upload your memo as a PDF or Word document.");
  if (args.link && !isAcceptableLink(args.link)) return fail(400, "That link doesn't look right. Paste the full https:// link.");
  if (!args.filePath && !args.link) return fail(400, "Upload a file or paste a link.");
  if (args.filePath) {
    const there = await uploadedFileExists(service, { userId: args.userId, certificationId: args.cert.id, path: args.filePath });
    if (!there) return fail(400, "The upload didn't arrive. Please try again.");
  }

  const { data: row, error } = await service
    .from("certification_submissions")
    .insert({
      user_id: args.userId,
      certification_id: args.cert.id,
      kind: args.kind,
      attempt,
      status: "submitted",
      file_path: args.filePath ?? null,
      file_name: args.fileName ? args.fileName.slice(0, 200) : null,
      link_url: args.link?.trim() ?? null,
      learner_note: args.note?.trim() ? args.note.trim().slice(0, 2000) : null,
    })
    .select("id")
    .single();
  if (error || !row) {
    // A double press races the unique (user, cert, kind, attempt) key.
    if (error?.code === "23505") return fail(409, "You've already handed this in.");
    console.error("Capstone submit error:", error?.message);
    return fail(500, "Internal server error");
  }

  if (args.kind === "briefing") {
    const picks = drawPrompts(args.cfg.pushback.bank.length, args.cfg.pushback.count, args.rand);
    const { error: pe } = await service.from("certification_pushback_answers").insert(
      picks.map((prompt_index, i) => ({ submission_id: row.id, position: i + 1, prompt_index }))
    );
    if (pe) {
      console.error("Capstone pushback draw error:", pe.message);
      await service.from("certification_submissions").delete().eq("id", row.id);
      return fail(500, "Internal server error");
    }
  }

  await notifyStaff(service, args.cert, args.userId, args.kind, attempt).catch(() => {});
  return { ok: true, submissionId: row.id, attempt };
}

// ---------------------------------------------------------------- pushback

async function ownBriefing(service: SupabaseClient, userId: string, certificationId: string, submissionId: string) {
  const { data } = await service
    .from("certification_submissions")
    .select("id, user_id, certification_id, kind, status")
    .eq("id", submissionId)
    .maybeSingle();
  if (!data || data.user_id !== userId || data.certification_id !== certificationId || data.kind !== "briefing") return null;
  return data;
}

export async function revealPushback(
  service: SupabaseClient,
  args: { userId: string; cert: CapstoneCert; cfg: CapstoneConfig; submissionId: string; position: number; now?: Date }
): Promise<{ ok: true; prompt: { speaker: string; text: string }; revealedAt: string } | Fail> {
  const sub = await ownBriefing(service, args.userId, args.cert.id, args.submissionId);
  if (!sub) return fail(404, "Not found");
  if (sub.status !== "submitted") return fail(409, "This briefing has already been marked.");
  const { data: rows } = await service
    .from("certification_pushback_answers")
    .select(PB_COLS)
    .eq("submission_id", sub.id)
    .order("position", { ascending: true });
  const list = (rows ?? []) as PushbackRow[];
  const target = list.find((r) => r.position === args.position);
  if (!target) return fail(404, "Not found");
  if (list.some((r) => r.position < args.position && !r.answered_at)) {
    return fail(409, "Answer the earlier question first.");
  }
  let revealedAt = target.revealed_at;
  if (!revealedAt) {
    revealedAt = (args.now ?? new Date()).toISOString();
    // Only the first reveal counts: a reload can't restart the clock.
    const { data: upd } = await service
      .from("certification_pushback_answers")
      .update({ revealed_at: revealedAt })
      .eq("id", target.id)
      .is("revealed_at", null)
      .select("revealed_at");
    if (!upd || upd.length === 0) {
      const { data: again } = await service
        .from("certification_pushback_answers")
        .select("revealed_at")
        .eq("id", target.id)
        .maybeSingle();
      revealedAt = again?.revealed_at ?? revealedAt;
    }
  }
  const prompt = args.cfg.pushback.bank[target.prompt_index];
  return { ok: true, prompt, revealedAt: revealedAt! };
}

export async function answerPushback(
  service: SupabaseClient,
  args: {
    userId: string;
    cert: CapstoneCert;
    submissionId: string;
    position: number;
    filePath: string;
    recordedInBrowser: boolean;
    now?: Date;
  }
): Promise<{ ok: true } | Fail> {
  const sub = await ownBriefing(service, args.userId, args.cert.id, args.submissionId);
  if (!sub) return fail(404, "Not found");
  if (sub.status !== "submitted") return fail(409, "This briefing has already been marked.");
  const { data: target } = await service
    .from("certification_pushback_answers")
    .select(PB_COLS)
    .eq("submission_id", sub.id)
    .eq("position", args.position)
    .maybeSingle();
  if (!target) return fail(404, "Not found");
  if (!target.revealed_at) return fail(409, "Show the question first.");
  if (target.answered_at) return fail(409, "You've already answered this question.");
  const there = await uploadedFileExists(service, { userId: args.userId, certificationId: args.cert.id, path: args.filePath });
  if (!there) return fail(400, "The recording didn't arrive. Please try again.");
  const { data: upd, error } = await service
    .from("certification_pushback_answers")
    .update({
      answered_at: (args.now ?? new Date()).toISOString(),
      file_path: args.filePath,
      recorded_in_browser: args.recordedInBrowser,
    })
    .eq("id", target.id)
    .is("answered_at", null)
    .select("id");
  if (error) {
    console.error("Capstone pushback answer error:", error.message);
    return fail(500, "Internal server error");
  }
  if (!upd || upd.length === 0) return fail(409, "You've already answered this question.");
  return { ok: true };
}

// ---------------------------------------------------------------- review

export async function reviewPiece(
  service: SupabaseClient,
  args: { submissionId: string; reviewerId: string; decision: SubmissionStatus; feedback?: string; now?: Date }
): Promise<{ ok: true; userId: string; certificationId: string } | Fail> {
  const { data: sub } = await service
    .from("certification_submissions")
    .select("id, user_id, certification_id, kind, attempt, status")
    .eq("id", args.submissionId)
    .maybeSingle();
  if (!sub) return fail(404, "Not found");
  if (sub.status !== "submitted") return fail(409, "This piece has already been marked.");
  if (!allowedDecisions(sub.attempt).includes(args.decision)) {
    return fail(400, sub.attempt > 1 ? "A resubmission can only pass or not pass." : "Choose Pass or Resubmit.");
  }
  if (args.decision !== "passed" && !args.feedback?.trim()) {
    return fail(400, "Add feedback so the learner knows what to change.");
  }
  if (sub.kind === "briefing" && args.decision === "passed") {
    const { data: pb } = await service
      .from("certification_pushback_answers")
      .select("answered_at")
      .eq("submission_id", sub.id);
    if (!pb || pb.length === 0 || pb.some((r: { answered_at: string | null }) => !r.answered_at)) {
      return fail(409, "The learner hasn't answered all three pushback questions yet.");
    }
  }
  const { data: upd, error } = await service
    .from("certification_submissions")
    .update({
      status: args.decision,
      reviewed_at: (args.now ?? new Date()).toISOString(),
      reviewed_by: args.reviewerId,
      feedback: args.feedback?.trim() ? args.feedback.trim().slice(0, 5000) : null,
    })
    .eq("id", sub.id)
    .eq("status", "submitted")
    .select("id");
  if (error) {
    console.error("Capstone review error:", error.message);
    return fail(500, "Internal server error");
  }
  if (!upd || upd.length === 0) return fail(409, "This piece has already been marked.");
  await notifyLearner(service, sub.user_id, sub.certification_id, sub.kind, args.decision, args.feedback).catch(() => {});
  return { ok: true, userId: sub.user_id, certificationId: sub.certification_id };
}

// ---------------------------------------------------------------- email

const PIECE: Record<CapstoneKind, string> = { memo: "interpretation memo", briefing: "executive briefing" };

async function notifyStaff(
  service: SupabaseClient,
  cert: CapstoneCert,
  learnerId: string,
  kind: CapstoneKind,
  attempt: number
) {
  const ids = cert.notify_user_ids ?? [];
  if (ids.length === 0) return;
  const [{ data: staff }, { data: learner }] = await Promise.all([
    service.from("users").select("email").in("id", ids),
    service.from("users").select("first_name, last_name").eq("id", learnerId).maybeSingle(),
  ]);
  const to = (staff ?? []).map((s: { email: string }) => s.email).filter(Boolean);
  if (to.length === 0) return;
  const who = `${learner?.first_name ?? ""} ${learner?.last_name ?? ""}`.trim() || "A learner";
  const tpl = customTemplate({
    subject: `${cert.name}: ${PIECE[kind]} ready to mark`,
    bodyText: `${who} handed in their ${PIECE[kind]}${attempt > 1 ? " (resubmission)" : ""} for ${cert.name}.${
      kind === "briefing" ? "\n\nThey'll answer the three pushback questions next; the briefing can be passed once all three are in." : ""
    }`,
    ctaText: "Open the Award screen",
    ctaUrl: `${appUrl()}/admin/certifications`,
  });
  await sendEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
}

async function notifyLearner(
  service: SupabaseClient,
  userId: string,
  certificationId: string,
  kind: CapstoneKind,
  decision: SubmissionStatus,
  feedback?: string
) {
  const [{ data: u }, { data: c }] = await Promise.all([
    service.from("users").select("email, first_name").eq("id", userId).maybeSingle(),
    service.from("certifications").select("name").eq("id", certificationId).maybeSingle(),
  ]);
  if (!u?.email) return;
  const name = c?.name ?? "your certification";
  const lines: Record<string, string> = {
    passed: `Your ${PIECE[kind]} for ${name} has passed.`,
    resubmit: `Your ${PIECE[kind]} for ${name} doesn't meet the bar yet. You have one resubmission.`,
    not_passed: `Your resubmitted ${PIECE[kind]} for ${name} didn't meet the bar.`,
  };
  const tpl = customTemplate({
    subject: `${name}: your ${PIECE[kind]}`,
    bodyText: `Hi ${u.first_name || "there"},\n\n${lines[decision] ?? ""}${feedback?.trim() ? `\n\nFeedback from your assessor:\n${feedback.trim()}` : ""}`,
    ctaText: "Open your capstone",
    ctaUrl: `${appUrl()}/learn/capstone/${certificationId}`,
  });
  await sendEmail({ to: u.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
}

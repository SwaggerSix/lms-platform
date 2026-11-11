import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MARKING_BUSINESS_DAYS, addBusinessDays, isFinalAllowedAttempt } from "@/lib/capstones/rules";
import CapstonesClient, { type QueueRow } from "./capstones-client";

export const metadata: Metadata = { title: "Capstone marking | LMS Platform" };

export default async function CapstoneMarkingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const service = createServiceClient();
  const { data: me } = await service.from("users").select("id, role").eq("auth_id", user.id).single();
  if (!me || !["admin", "super_admin"].includes(me.role)) redirect("/dashboard");

  const { data } = await service
    .from("capstone_submissions")
    .select(
      `id, attempt, status, files, links, learner_note, submitted_at, graded_at, feedback, another_attempt_allowed,
       certification:certifications ( id, name, max_capstone_attempts ),
       learner:users!capstone_submissions_user_id_fkey ( id, first_name, last_name, email ),
       grader:users!capstone_submissions_graded_by_fkey ( first_name, last_name ),
       certificate:user_certifications ( id, verification_code, public_url, expires_at, metadata )`
    )
    .order("submitted_at", { ascending: false })
    .limit(500);

  type Raw = {
    id: string;
    attempt: number;
    status: QueueRow["status"];
    files: QueueRow["files"];
    links: QueueRow["links"];
    learner_note: string | null;
    submitted_at: string;
    graded_at: string | null;
    feedback: string | null;
    another_attempt_allowed: boolean;
    certification: { id: string; name: string; max_capstone_attempts: number } | null;
    learner: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
    grader: { first_name: string | null; last_name: string | null } | null;
    certificate: { id: string; verification_code: string | null; public_url: string | null; expires_at: string | null; metadata: Record<string, unknown> | null } | null;
  };
  const raw = (data ?? []) as unknown as Raw[];

  // The newest attempt per learner + certification decides "needs a call".
  const latestKey = new Map<string, number>();
  for (const r of raw) {
    const k = `${r.learner?.id}:${r.certification?.id}`;
    latestKey.set(k, Math.max(latestKey.get(k) ?? 0, r.attempt));
  }

  const rows: QueueRow[] = raw.map((r) => {
    const max = r.certification?.max_capstone_attempts ?? 2;
    const isLatest = latestKey.get(`${r.learner?.id}:${r.certification?.id}`) === r.attempt;
    const needsCall = isLatest && r.status === "not_yet" && isFinalAllowedAttempt(r.attempt, max) && !r.another_attempt_allowed;
    const portal = (r.certificate?.metadata?.portal_sync ?? null) as QueueRow["portal"];
    return {
      id: r.id,
      attempt: r.attempt,
      maxAttempts: max,
      status: r.status,
      needsCall,
      anotherAttemptAllowed: r.another_attempt_allowed,
      files: r.files ?? [],
      links: r.links ?? [],
      note: r.learner_note,
      submittedAt: r.submitted_at,
      markBy: addBusinessDays(new Date(r.submitted_at), MARKING_BUSINESS_DAYS).toISOString(),
      gradedAt: r.graded_at,
      feedback: r.feedback,
      certName: r.certification?.name ?? "Certification",
      learnerName: [r.learner?.first_name, r.learner?.last_name].filter(Boolean).join(" ") || r.learner?.email || "Learner",
      learnerEmail: r.learner?.email ?? "",
      graderName: [r.grader?.first_name, r.grader?.last_name].filter(Boolean).join(" ") || null,
      certificate: r.certificate
        ? { verifyUrl: r.certificate.public_url, expiresAt: r.certificate.expires_at }
        : null,
      portal,
    };
  });

  return <CapstonesClient rows={rows} />;
}

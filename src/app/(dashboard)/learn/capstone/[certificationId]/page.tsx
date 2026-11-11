import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { learnerCapstoneContext } from "@/lib/capstones/context";
import { MARKING_BUSINESS_DAYS, addBusinessDays } from "@/lib/capstones/rules";
import CapstoneClient, { type AttemptView } from "./capstone-client";

export const metadata: Metadata = {
  title: "Capstone | LMS Platform",
};

export default async function CapstonePage({ params }: { params: Promise<{ certificationId: string }> }) {
  const { certificationId } = await params;
  const ctx = await learnerCapstoneContext(certificationId);
  if (!ctx.ok) {
    if (ctx.status === 401) redirect("/login");
    notFound();
  }

  const { data: path } = await ctx.service
    .from("learning_paths")
    .select("title, slug")
    .eq("id", ctx.certification.learning_path_id!)
    .maybeSingle();

  const attempts: AttemptView[] = ctx.attempts.map((a) => ({
    id: a.id,
    attempt: a.attempt,
    status: a.status,
    submittedAt: a.submitted_at,
    markBy: addBusinessDays(new Date(a.submitted_at), MARKING_BUSINESS_DAYS).toISOString(),
    gradedAt: a.graded_at,
    feedback: a.status === "submitted" ? null : a.feedback,
    files: a.files.map((f) => ({ name: f.name, path: f.path, size: f.size })),
    links: a.links,
    note: a.learner_note,
  }));

  return (
    <CapstoneClient
      certificationId={ctx.certification.id}
      certName={ctx.certification.name}
      instructions={ctx.certification.capstone_instructions}
      state={ctx.state}
      progress={ctx.progress}
      maxAttempts={ctx.certification.max_capstone_attempts}
      path={path ? { title: path.title as string, slug: path.slug as string } : null}
      attempts={attempts}
    />
  );
}

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import QuestionBuilderClient, { type BuilderQuestion } from "./question-builder-client";

export const metadata: Metadata = {
  title: "Edit Examination | LMS Platform",
};

export default async function EditAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await service
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();
  if (!profile || !["admin", "super_admin", "instructor"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const { data: assessment } = await service
    .from("assessments")
    .select("id, title, status, passing_score, questions(*)")
    .eq("id", id)
    .single();

  if (!assessment) notFound();

  const questions: BuilderQuestion[] = (assessment.questions ?? [])
    .sort((a: any, b: any) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
    .map((q: any) => ({
      question_text: q.question_text ?? "",
      question_type: q.question_type ?? "multiple_choice",
      points: q.points ?? 1,
      explanation: q.explanation ?? "",
      correct_answer: typeof q.correct_answer === "string" ? q.correct_answer : "",
      options: Array.isArray(q.options)
        ? q.options.map((o: any) => ({ text: o.text ?? "", is_correct: !!o.is_correct }))
        : [],
    }));

  return (
    <QuestionBuilderClient
      assessmentId={assessment.id}
      title={assessment.title}
      initialStatus={(assessment.status as "draft" | "published" | "archived") ?? "published"}
      initialQuestions={questions}
    />
  );
}

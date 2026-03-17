import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AssessmentTakingClient from "./assessment-taking-client";
import type { AssessmentData } from "./assessment-taking-client";

export default async function AssessmentTakingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get the user record from the users table
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  // Fetch assessment with course title, questions, and previous attempts in parallel
  const [assessmentResult, questionsResult, attemptsResult] = await Promise.all([
    supabase
      .from("assessments")
      .select(`
        id,
        title,
        description,
        passing_score,
        time_limit,
        max_attempts,
        question_count,
        course:courses ( title )
      `)
      .eq("id", id)
      .single(),

    supabase
      .from("questions")
      .select("id, question_text, question_type, points, options, sequence_order")
      .eq("assessment_id", id)
      .order("sequence_order", { ascending: true }),

    supabase
      .from("assessment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", dbUser.id)
      .eq("assessment_id", id),
  ]);

  const assessment = assessmentResult.data as any;
  const questions = (questionsResult.data ?? []) as any[];

  const data: AssessmentData = {
    assessment: {
      id: assessment?.id ?? id,
      title: assessment?.title ?? "Assessment",
      description: assessment?.description ?? "",
      passing_score: assessment?.passing_score ?? 70,
      time_limit: assessment?.time_limit ?? null,
      max_attempts: assessment?.max_attempts ?? 3,
      question_count: assessment?.question_count ?? questions.length,
      course_title: assessment?.course?.title ?? "Course",
    },
    questions: questions.map((q: any) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type ?? "multiple_choice",
      points: q.points ?? 1,
      options: Array.isArray(q.options)
        ? q.options
        : [{ label: "A", value: "Option A" }],
      sequence_order: q.sequence_order ?? 0,
    })),
    previousAttemptCount: attemptsResult.count ?? 0,
  };

  return <AssessmentTakingClient data={data} />;
}

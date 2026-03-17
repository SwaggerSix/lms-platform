import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AssessmentResultsClient from "./assessment-results-client";
import type { AssessmentResultsData, ReviewQuestion } from "./assessment-results-client";

export default async function AssessmentResultsPage({
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

  // Fetch assessment details, latest attempt, questions, and total attempts in parallel
  const [assessmentResult, latestAttemptResult, questionsResult, totalAttemptsResult] =
    await Promise.all([
      supabase
        .from("assessments")
        .select("id, title, passing_score, max_attempts, show_correct_answers")
        .eq("id", id)
        .single(),

      supabase
        .from("assessment_attempts")
        .select("id, score, passed, answers, started_at, completed_at, time_spent")
        .eq("user_id", dbUser.id)
        .eq("assessment_id", id)
        .order("completed_at", { ascending: false })
        .limit(1)
        .single(),

      supabase
        .from("questions")
        .select("id, question_text, question_type, points, explanation, options, sequence_order")
        .eq("assessment_id", id)
        .order("sequence_order", { ascending: true }),

      supabase
        .from("assessment_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", dbUser.id)
        .eq("assessment_id", id),
    ]);

  const assessment = assessmentResult.data as any;
  const attempt = latestAttemptResult.data as any;
  const questions = (questionsResult.data ?? []) as any[];
  const totalAttempts = totalAttemptsResult.count ?? 0;

  const score = Math.round(attempt?.score ?? 0);
  const passed = attempt?.passed ?? false;
  const passingScore = assessment?.passing_score ?? 70;
  const maxAttempts = assessment?.max_attempts ?? 3;
  const showCorrectAnswers = assessment?.show_correct_answers !== false;

  // Format time taken from seconds
  const timeSpentSec = attempt?.time_spent ?? 0;
  const mins = Math.floor(timeSpentSec / 60);
  const secs = timeSpentSec % 60;
  const timeTaken = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  // Build review questions from DB questions + user answers
  const userAnswers: Record<string, string> = attempt?.answers ?? {};

  // Determine correct answer from options (look for correct flag in JSONB)
  const reviewQuestions: ReviewQuestion[] = questions.map((q: any) => {
    const opts = Array.isArray(q.options) ? q.options : [];
    const optionValues = opts.map((o: any) =>
      typeof o === "string" ? o : o.value ?? o.label ?? ""
    );
    const correctOption = opts.find(
      (o: any) => o.correct === true || o.is_correct === true
    );
    const correctAnswer = correctOption
      ? correctOption.value ?? correctOption.label ?? ""
      : optionValues[0] ?? "";
    const userAnswer = userAnswers[q.id] ?? "";
    const isCorrect = userAnswer === correctAnswer;

    return {
      id: q.id,
      text: q.question_text ?? "",
      options: optionValues,
      userAnswer,
      correctAnswer,
      explanation: q.explanation ?? "",
      isCorrect,
    };
  });

  const correctCount = reviewQuestions.filter((q) => q.isCorrect).length;

  const data: AssessmentResultsData = {
    score,
    passed,
    timeTaken,
    correctCount,
    totalQuestions: questions.length,
    passingScore,
    attemptsRemaining: Math.max(0, maxAttempts - totalAttempts),
    assessmentId: id,
    reviewQuestions,
    showCorrectAnswers,
  };

  return <AssessmentResultsClient data={data} />;
}

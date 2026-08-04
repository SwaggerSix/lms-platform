import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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
  const service = createServiceClient();
  const { data: dbUser } = await service
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
      service
        .from("assessments")
        .select("id, title, passing_score, max_attempts, show_correct_answers")
        .eq("id", id)
        .single(),

      service
        .from("assessment_attempts")
        .select("id, score, passed, answers, started_at, completed_at, time_spent")
        .eq("user_id", dbUser.id)
        .eq("assessment_id", id)
        .order("completed_at", { ascending: false })
        .limit(1)
        .single(),

      service
        .from("questions")
        .select("id, question_text, question_type, points, explanation, options, sequence_order")
        .eq("assessment_id", id)
        .order("sequence_order", { ascending: true }),

      service
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

  // The submit route persists `answers` as an array of graded entries
  // ({ question_id, selected_options?, text_answer?, is_correct, ... }), so it
  // must be indexed by question_id — not treated as a { [questionId]: string }
  // map (which always yielded undefined, blanking every review row and forcing
  // correctCount to 0). Fall back gracefully if a legacy object shape appears.
  const rawAnswers = attempt?.answers;
  const answersByQuestion = new Map<string, any>();
  if (Array.isArray(rawAnswers)) {
    for (const a of rawAnswers) {
      if (a && typeof a === "object" && a.question_id) answersByQuestion.set(a.question_id, a);
    }
  } else if (rawAnswers && typeof rawAnswers === "object") {
    for (const [qid, val] of Object.entries(rawAnswers)) {
      answersByQuestion.set(qid, { question_id: qid, text_answer: val });
    }
  }

  const optionText = (o: any): string =>
    typeof o === "string" ? o : o?.text ?? o?.label ?? o?.value ?? "";

  // Determine correct answer from options (look for correct flag in JSONB)
  const reviewQuestions: ReviewQuestion[] = questions.map((q: any) => {
    const opts = Array.isArray(q.options) ? q.options : [];
    const optionValues = opts.map(optionText);
    const correctOption = opts.find(
      (o: any) => o?.correct === true || o?.is_correct === true
    );
    const correctAnswer = correctOption ? optionText(correctOption) : optionValues[0] ?? "";

    const graded = answersByQuestion.get(q.id);
    // Reconstruct the learner's answer text from whichever shape was stored:
    // option selections (indexes into the options array) or a free-text answer.
    let userAnswer = "";
    if (graded) {
      if (Array.isArray(graded.selected_options) && graded.selected_options.length) {
        userAnswer = graded.selected_options
          .map((idx: number) => optionValues[idx])
          .filter(Boolean)
          .join(", ");
      } else if (typeof graded.text_answer === "string") {
        userAnswer = graded.text_answer;
      }
    }
    // Trust the grade recorded at submission time; only recompute if absent.
    const isCorrect =
      typeof graded?.is_correct === "boolean"
        ? graded.is_correct
        : userAnswer !== "" && userAnswer === correctAnswer;

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

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { trackLearningEvent } from "@/lib/ai/track-event";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { assessment_id, answers, time_spent, class_id } = body;

  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 submissions per minute per user
  const { success } = await rateLimit(`assessment-submit:${authUser.user.id}`, 10, 60000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id")
    .eq("auth_id", authUser.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch assessment and questions
  const { data: assessment } = await service
    .from("assessments")
    .select("*, questions(*)")
    .eq("id", assessment_id)
    .single();

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  // Grade the assessment. Auto-graded: option-based (multiple_choice,
  // multi_select, true_false) and fill_blank (string match). Essay answers are
  // queued for manual grading.
  let totalPoints = 0;
  let earnedPoints = 0;
  let needsGrading = false;
  const gradedAnswers = (answers as Array<{
    question_id: string;
    selected_options?: number[];
    text_answer?: string;
  }>).map((answer) => {
    const question = assessment.questions.find((q: { id: string }) => q.id === answer.question_id);
    if (!question) return { question_id: answer.question_id, is_correct: false, awarded_points: 0 };

    const points = question.points ?? 0;
    totalPoints += points;
    const type = question.question_type;
    const base = {
      question_id: answer.question_id,
      question_text: question.question_text,
      question_type: type,
      points,
    };

    if (type === "essay") {
      needsGrading = true;
      return { ...base, text_answer: answer.text_answer ?? "", is_correct: null, awarded_points: null };
    }

    if (type === "fill_blank") {
      const correct = String(question.correct_answer ?? "").trim().toLowerCase();
      const given = String(answer.text_answer ?? "").trim().toLowerCase();
      const isCorrect = correct.length > 0 && given === correct;
      if (isCorrect) earnedPoints += points;
      return { ...base, text_answer: answer.text_answer ?? "", is_correct: isCorrect, awarded_points: isCorrect ? points : 0 };
    }

    // Option-based grading.
    const correctOptions = (question.options ?? [])
      .map((opt: { is_correct: boolean }, idx: number) => (opt.is_correct ? idx : -1))
      .filter((idx: number) => idx >= 0);
    const selected = (answer.selected_options ?? []).slice().sort();
    const isCorrect = JSON.stringify(selected) === JSON.stringify(correctOptions.slice().sort());
    if (isCorrect) earnedPoints += points;
    return { ...base, selected_options: answer.selected_options ?? [], is_correct: isCorrect, awarded_points: isCorrect ? points : 0 };
  });

  const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
  // Pending manual grading → not yet passed; final result set when graded.
  const passed = needsGrading ? false : score >= assessment.passing_score;

  const { data: attempt, error } = await service
    .from("assessment_attempts")
    .insert({
      user_id: profile.id,
      assessment_id,
      score,
      passed,
      answers: gradedAnswers,
      time_spent,
      class_id: class_id ?? null,
      needs_grading: needsGrading,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Assessment submit error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  // Award points
  const points = passed ? 50 : 10;
  await service.from("points_ledger").insert({
    user_id: profile.id,
    action_type: passed ? "quiz_pass" : "quiz_attempt",
    points,
    reference_type: "assessment",
    reference_id: assessment_id,
  });

  // Bonus for perfect score
  if (score === 100 && !needsGrading) {
    await service.from("points_ledger").insert({
      user_id: profile.id,
      action_type: "perfect_score",
      points: 25,
      reference_type: "assessment",
      reference_id: assessment_id,
    });
  }

  // Track assessment event (fire-and-forget)
  trackLearningEvent({
    userId: profile.id,
    eventType: passed ? "assessment_pass" : "assessment_fail",
    metadata: {
      assessment_id,
      score,
      time_spent,
    },
  }).catch(() => {});

  // Fire webhook (non-blocking)
  dispatchWebhook("assessment.submitted", {
    assessment_id,
    user_id: profile.id,
    score,
  }).catch(() => {});

  return NextResponse.json({ attempt, score, passed, totalPoints, earnedPoints });
}

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

  const { assessment_id, answers, time_spent } = body;

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

  // Grade the assessment
  let totalPoints = 0;
  let earnedPoints = 0;
  const gradedAnswers = answers.map((answer: { question_id: string; selected_options: number[] }) => {
    const question = assessment.questions.find((q: { id: string }) => q.id === answer.question_id);
    if (!question) return { ...answer, is_correct: false };

    totalPoints += question.points;
    const correctOptions = question.options
      .map((opt: { is_correct: boolean }, idx: number) => (opt.is_correct ? idx : -1))
      .filter((idx: number) => idx >= 0);

    const isCorrect =
      JSON.stringify(answer.selected_options.sort()) === JSON.stringify(correctOptions.sort());

    if (isCorrect) earnedPoints += question.points;

    return { ...answer, is_correct: isCorrect };
  });

  const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
  const passed = score >= assessment.passing_score;

  const { data: attempt, error } = await service
    .from("assessment_attempts")
    .insert({
      user_id: profile.id,
      assessment_id,
      score,
      passed,
      answers: gradedAnswers,
      time_spent,
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
  if (score === 100) {
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

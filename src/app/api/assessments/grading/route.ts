import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/assessments/grading
 * Queue of attempts awaiting manual grading (essay answers), for staff.
 */
export async function GET() {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { data, error } = await service
    .from("assessment_attempts")
    .select(
      "id, score, completed_at, answers, " +
        "user:users(first_name, last_name, email), " +
        "assessment:assessments(title, passing_score)"
    )
    .eq("needs_grading", true)
    .order("completed_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Grading queue error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const queue = ((data ?? []) as any[]).map((a) => {
    const user = Array.isArray(a.user) ? a.user[0] : a.user;
    const assessment = Array.isArray(a.assessment) ? a.assessment[0] : a.assessment;
    const pending = (Array.isArray(a.answers) ? a.answers : []).filter(
      (ans: any) => ans.question_type === "essay" && (ans.awarded_points === null || ans.awarded_points === undefined)
    );
    return {
      id: a.id,
      learner_name: user ? `${user.first_name} ${user.last_name}` : "Unknown",
      learner_email: user?.email ?? null,
      assessment_title: assessment?.title ?? "Examination",
      completed_at: a.completed_at,
      pending_answers: pending.map((ans: any) => ({
        question_id: ans.question_id,
        question_text: ans.question_text ?? "",
        text_answer: ans.text_answer ?? "",
        points: ans.points ?? 0,
      })),
    };
  });

  return NextResponse.json({ queue, total: queue.length });
}

/**
 * POST /api/assessments/grading
 * Award points to essay answers and finalize the attempt's score.
 * Body: { attempt_id, grades: [{ question_id, awarded_points }] }
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { attempt_id, grades } = body as {
    attempt_id?: string;
    grades?: { question_id: string; awarded_points: number }[];
  };
  if (!attempt_id || !Array.isArray(grades)) {
    return NextResponse.json({ error: "attempt_id and grades are required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: attempt } = await service
    .from("assessment_attempts")
    .select("id, answers, assessment:assessments(passing_score)")
    .eq("id", attempt_id)
    .single();
  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

  const passingScore =
    (Array.isArray(attempt.assessment) ? attempt.assessment[0] : (attempt.assessment as any))?.passing_score ?? 70;
  const gradeMap = new Map(grades.map((g) => [g.question_id, g.awarded_points]));

  const answers = (Array.isArray(attempt.answers) ? attempt.answers : []) as any[];
  const updatedAnswers = answers.map((ans) => {
    if (ans.question_type === "essay" && gradeMap.has(ans.question_id)) {
      const awarded = Math.max(0, Math.min(Number(gradeMap.get(ans.question_id)) || 0, ans.points ?? 0));
      return { ...ans, awarded_points: awarded, is_correct: awarded >= (ans.points ?? 0) && (ans.points ?? 0) > 0 };
    }
    return ans;
  });

  const totalPoints = updatedAnswers.reduce((s, a) => s + (a.points ?? 0), 0);
  const earnedPoints = updatedAnswers.reduce((s, a) => s + (a.awarded_points ?? 0), 0);
  const stillPending = updatedAnswers.some(
    (a) => a.question_type === "essay" && (a.awarded_points === null || a.awarded_points === undefined)
  );
  const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
  const passed = stillPending ? false : score >= passingScore;

  const { error } = await service
    .from("assessment_attempts")
    .update({
      answers: updatedAnswers,
      score,
      passed,
      needs_grading: stillPending,
      graded_at: new Date().toISOString(),
      graded_by: auth.user.id,
    })
    .eq("id", attempt_id);

  if (error) {
    console.error("Grading save error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true, score, passed, needs_grading: stillPending });
}

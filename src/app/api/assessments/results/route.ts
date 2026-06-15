import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/assessments/results
 * Admin/instructor examination results report. Each row is one attempt.
 * Query params (all optional): assessment_id, course_id, class_id, passed,
 * date_from, date_to.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const assessmentId = searchParams.get("assessment_id");
  const courseId = searchParams.get("course_id");
  const classId = searchParams.get("class_id");
  const passed = searchParams.get("passed");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  const service = createServiceClient();

  let query = service
    .from("assessment_attempts")
    .select(
      "id, score, passed, time_spent, completed_at, class_id, " +
        "user:users(first_name, last_name, email), " +
        "assessment:assessments(title, course_id, course:courses(title)), " +
        "class:classes(title)"
    )
    .order("completed_at", { ascending: false })
    .limit(2000);

  if (assessmentId) query = query.eq("assessment_id", assessmentId);
  if (classId) query = query.eq("class_id", classId);
  if (passed === "true") query = query.eq("passed", true);
  if (passed === "false") query = query.eq("passed", false);
  if (dateFrom) query = query.gte("completed_at", dateFrom);
  if (dateTo) query = query.lte("completed_at", dateTo);

  const { data, error } = await query;
  if (error) {
    console.error("Assessment results error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  let rows = ((data ?? []) as any[]).map((a) => {
    const user = Array.isArray(a.user) ? a.user[0] : (a.user as any);
    const assessment = Array.isArray(a.assessment) ? a.assessment[0] : (a.assessment as any);
    const rawCourse = assessment?.course as any;
    const course = Array.isArray(rawCourse) ? rawCourse[0] : rawCourse;
    const cls = Array.isArray(a.class) ? a.class[0] : (a.class as any);
    return {
      id: a.id,
      learner_name: user ? `${user.first_name} ${user.last_name}` : "Unknown",
      learner_email: user?.email ?? null,
      assessment_title: assessment?.title ?? "Examination",
      course_id: assessment?.course_id ?? null,
      course_title: course?.title ?? null,
      class_title: cls?.title ?? null,
      score: a.score != null ? Number(a.score) : null,
      passed: !!a.passed,
      time_spent: a.time_spent,
      completed_at: a.completed_at,
    };
  });

  // course_id lives on the assessment, so filter in app layer.
  if (courseId) rows = rows.filter((r) => r.course_id === courseId);

  return NextResponse.json({ results: rows, total: rows.length });
}

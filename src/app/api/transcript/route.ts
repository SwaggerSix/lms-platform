import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EnrollmentStatus, CourseType } from "@/types/database";

/**
 * GET /api/transcript
 * Query params: status, course_type, date_from, date_to, user_id
 * Returns learning transcript entries from enrollments + courses
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status") as EnrollmentStatus | null;
  const courseType = searchParams.get("course_type") as CourseType | null;
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const userId = searchParams.get("user_id");

  // Get current authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up the profile ID from the users table
  const { data: profile } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Determine target user: default to current user's profile ID
  let targetUserId: string | null = profile.id;
  if (userId && userId !== profile.id) {
    // Viewing another user's transcript requires admin or manager role
    if (profile.role !== "admin" && profile.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    targetUserId = userId;
  }

  let query = supabase
    .from("enrollments")
    .select("*, course:courses(title, course_type, estimated_duration)")
    .order("enrolled_at", { ascending: false });

  if (targetUserId) {
    query = query.eq("user_id", targetUserId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (dateFrom) {
    query = query.gte("enrolled_at", dateFrom);
  }
  if (dateTo) {
    query = query.lte("enrolled_at", dateTo);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map to transcript entries
  let entries = (data ?? []).map((e) => ({
    course_title: e.course?.title ?? "Unknown Course",
    course_type: e.course?.course_type ?? "self_paced",
    enrollment_date: e.enrolled_at ? new Date(e.enrolled_at).toISOString().split("T")[0] : null,
    completion_date: e.completed_at ? new Date(e.completed_at).toISOString().split("T")[0] : null,
    status: e.status,
    score: e.score ? Number(e.score) : null,
    credits: e.course?.estimated_duration ? Math.round(e.course.estimated_duration / 60 * 10) / 10 : 0,
    certificate_id: e.certificate_issued ? e.id : null,
  }));

  // Filter by course_type if needed (from joined course data)
  if (courseType) {
    entries = entries.filter((e) => e.course_type === courseType);
  }

  const completedCount = entries.filter((e) => e.status === "completed").length;
  const totalCredits = entries
    .filter((e) => e.status === "completed")
    .reduce((sum, e) => sum + (e.credits || 0), 0);

  return NextResponse.json({
    entries,
    total: entries.length,
    summary: {
      completed_count: completedCount,
      total_credits: totalCredits,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { validateBody, updateClassSchema } from "@/lib/validations";

/**
 * GET /api/classes/[classId]
 * The unified "class card": class details plus its sessions, materials,
 * assessments, participant count, and the caller's own participation/progress.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: cls, error: clsErr } = await service
    .from("classes")
    .select("*, course:courses(id, title, slug, description, thumbnail_url, course_type, difficulty_level, estimated_duration, passing_score), instructor:users!classes_instructor_id_fkey(first_name, last_name, bio)")
    .eq("id", classId)
    .single();

  if (clsErr || !cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const rawCourse = cls.course as any;
  const course = Array.isArray(rawCourse) ? rawCourse[0] : rawCourse;
  const rawInstructor = cls.instructor as any;
  const instructor = Array.isArray(rawInstructor) ? rawInstructor[0] : rawInstructor;
  const courseId = cls.course_id;

  // The caller's own participation in this class.
  const { data: myParticipation } = await service
    .from("class_participants")
    .select("role, status, enrolled_at")
    .eq("class_id", classId)
    .eq("user_id", profile.id)
    .maybeSingle();

  const isStaff = ["admin", "super_admin", "instructor"].includes(profile.role);
  const canSeeFacilitator = isStaff || myParticipation?.role === "instructor";

  const [
    { data: sessions },
    { data: resources },
    { data: assessments },
    { data: participants },
    { data: enrollment },
  ] = await Promise.all([
    service
      .from("ilt_sessions")
      .select("id, title, description, session_date, start_time, end_time, timezone, location_type, location_details, meeting_url, max_capacity, status, recording_url")
      .eq("class_id", classId)
      .order("session_date", { ascending: true }),
    service
      .from("course_resources")
      .select("id, title, resource_type, audience, file_url, file_name, file_type")
      .eq("course_id", courseId)
      .order("created_at", { ascending: true }),
    service
      .from("assessments")
      .select("id, title, description, passing_score, time_limit, max_attempts, question_count")
      .eq("course_id", courseId),
    service
      .from("class_participants")
      .select("id, user_id, role, status, enrolled_at, user:users(first_name, last_name, email, job_title)")
      .eq("class_id", classId)
      .order("enrolled_at", { ascending: true }),
    service
      .from("enrollments")
      .select("status, score, completed_at")
      .eq("course_id", courseId)
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);

  // The caller's session registrations within this class.
  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: myRegs } = sessionIds.length
    ? await service
        .from("ilt_attendance")
        .select("session_id, registration_status, attendance_status")
        .eq("user_id", profile.id)
        .in("session_id", sessionIds)
    : { data: [] as { session_id: string; registration_status: string; attendance_status: string | null }[] };
  const regMap: Record<string, { registration_status: string; attendance_status: string | null }> = {};
  for (const r of myRegs ?? []) {
    regMap[r.session_id] = { registration_status: r.registration_status, attendance_status: r.attendance_status };
  }

  const materials = (resources ?? [])
    .filter((r) => canSeeFacilitator || r.audience === "learner")
    .map((r) => ({
      id: r.id,
      title: r.title,
      resource_type: r.resource_type,
      audience: r.audience,
      file_url: r.file_url,
      file_name: r.file_name,
      file_type: r.file_type,
    }));

  const roster = (participants ?? [])
    .filter((p) => p.status === "active")
    .map((p) => {
      const u = Array.isArray(p.user) ? p.user[0] : (p.user as any);
      return {
        id: p.id,
        user_id: p.user_id,
        role: p.role,
        name: u ? `${u.first_name} ${u.last_name}` : "Unknown",
        email: u?.email ?? null,
        job_title: u?.job_title ?? null,
        enrolled_at: p.enrolled_at,
      };
    });

  return NextResponse.json({
    class: {
      id: cls.id,
      course_id: cls.course_id,
      title: cls.title,
      description: cls.description,
      start_date: cls.start_date,
      end_date: cls.end_date,
      timezone: cls.timezone,
      status: cls.status,
      enrollment_type: cls.enrollment_type,
      max_capacity: cls.max_capacity,
      instructor_name: instructor ? `${instructor.first_name} ${instructor.last_name}` : null,
      instructor_bio: instructor?.bio ?? null,
    },
    course: course
      ? {
          id: course.id,
          title: course.title,
          slug: course.slug,
          description: course.description,
          thumbnail_url: course.thumbnail_url,
          course_type: course.course_type,
          difficulty_level: course.difficulty_level,
          estimated_duration: course.estimated_duration,
          passing_score: course.passing_score,
        }
      : null,
    sessions: (sessions ?? []).map((s) => ({
      ...s,
      my_registration: regMap[s.id] ?? null,
    })),
    materials,
    exams: assessments ?? [],
    participants: roster,
    participant_count: roster.filter((p) => p.role === "learner").length,
    my_participation: myParticipation ?? null,
    my_enrollment: enrollment ?? null,
    can_manage: isStaff,
  });
}

/**
 * PATCH /api/classes/[classId] — update class details (admin/instructor).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const validation = validateBody(updateClassSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("classes")
    .update({ ...validation.data, updated_at: new Date().toISOString() })
    .eq("id", classId)
    .select()
    .single();

  if (error) {
    console.error("Classes PATCH error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ class: data });
}

/**
 * DELETE /api/classes/[classId] — cancel a class (soft delete).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { error } = await service
    .from("classes")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", classId);

  if (error) {
    console.error("Classes DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Class cancelled" });
}

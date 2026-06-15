import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { validateBody, createClassSchema, stripContractFieldsForNonAdmin } from "@/lib/validations";

/**
 * GET /api/classes
 * List classes (cohorts). Query params:
 *   - course_id: filter to one course
 *   - status: filter by class status
 *   - mine=true: only classes the authenticated user participates in
 */
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");
  const status = searchParams.get("status");
  const mine = searchParams.get("mine") === "true";
  const nasbaOnly = searchParams.get("nasba") === "true";

  // When "mine", restrict to the classes this user is a participant of.
  let allowedClassIds: string[] | null = null;
  if (mine) {
    const { data: memberships } = await service
      .from("class_participants")
      .select("class_id")
      .eq("user_id", profile.id)
      .eq("status", "active");
    allowedClassIds = (memberships ?? []).map((m) => m.class_id);
    if (allowedClassIds.length === 0) {
      return NextResponse.json({ classes: [], total: 0 });
    }
  }

  let query = service
    .from("classes")
    .select("*, course:courses(title, slug, thumbnail_url, nasba_certified, nasba_cpe_credits, nasba_field_of_study), instructor:users!classes_instructor_id_fkey(first_name, last_name)")
    .order("start_date", { ascending: true, nullsFirst: false });

  if (courseId) query = query.eq("course_id", courseId);
  if (status) query = query.eq("status", status);
  if (allowedClassIds) query = query.in("id", allowedClassIds);

  const { data: rows, error } = await query;
  if (error) {
    console.error("Classes GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const classIds = (rows ?? []).map((c) => c.id);

  // Participant counts (active learners) and next upcoming session per class.
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: participants }, { data: sessions }] = await Promise.all([
    classIds.length
      ? service.from("class_participants").select("class_id, role, status").in("class_id", classIds)
      : Promise.resolve({ data: [] as { class_id: string; role: string; status: string }[] }),
    classIds.length
      ? service
          .from("ilt_sessions")
          .select("class_id, session_date, start_time")
          .in("class_id", classIds)
          .gte("session_date", today)
          .neq("status", "cancelled")
          .order("session_date", { ascending: true })
      : Promise.resolve({ data: [] as { class_id: string; session_date: string; start_time: string }[] }),
  ]);

  const participantCount: Record<string, number> = {};
  for (const p of participants ?? []) {
    if (p.status !== "active" || p.role !== "learner") continue;
    participantCount[p.class_id] = (participantCount[p.class_id] || 0) + 1;
  }
  const nextSession: Record<string, { session_date: string; start_time: string }> = {};
  for (const s of sessions ?? []) {
    if (!nextSession[s.class_id]) {
      nextSession[s.class_id] = { session_date: s.session_date, start_time: s.start_time };
    }
  }

  const isAdmin = ["admin", "super_admin"].includes(profile.role);
  const classes = (rows ?? []).map((c) => {
    const rawCourse = c.course as any;
    const course = Array.isArray(rawCourse) ? rawCourse[0] : rawCourse;
    const rawInstructor = c.instructor as any;
    const instructor = Array.isArray(rawInstructor) ? rawInstructor[0] : rawInstructor;
    return {
      id: c.id,
      course_id: c.course_id,
      title: c.title,
      description: c.description,
      start_date: c.start_date,
      end_date: c.end_date,
      timezone: c.timezone,
      status: c.status,
      enrollment_type: c.enrollment_type,
      course_title: course?.title ?? "Untitled Course",
      course_slug: course?.slug ?? null,
      thumbnail_url: course?.thumbnail_url ?? null,
      instructor_name: instructor ? `${instructor.first_name} ${instructor.last_name}` : null,
      max_capacity: c.max_capacity,
      participant_count: participantCount[c.id] ?? 0,
      next_session: nextSession[c.id] ?? null,
      nasba_certified: !!course?.nasba_certified,
      nasba_cpe_credits: course?.nasba_cpe_credits ?? null,
      nasba_field_of_study: course?.nasba_field_of_study ?? null,
      // Contract details are admin-only.
      ...(isAdmin
        ? {
            contract_number: c.contract_number ?? null,
            contract_url: c.contract_url ?? null,
            contract_file_name: c.contract_file_name ?? null,
          }
        : {}),
    };
  });

  const filtered = nasbaOnly ? classes.filter((c) => c.nasba_certified) : classes;
  return NextResponse.json({ classes: filtered, total: filtered.length });
}

/**
 * POST /api/classes
 * Create a new class (cohort). Requires admin or instructor.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const validation = validateBody(createClassSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const data = stripContractFieldsForNonAdmin(validation.data, auth.user.role);

  const service = createServiceClient();
  const { data: created, error } = await service
    .from("classes")
    .insert({
      course_id: data.course_id,
      title: data.title,
      description: data.description ?? null,
      start_date: data.start_date ?? null,
      end_date: data.end_date ?? null,
      timezone: data.timezone ?? "America/New_York",
      instructor_id: data.instructor_id ?? null,
      max_capacity: data.max_capacity ?? null,
      status: data.status ?? "scheduled",
      enrollment_type: data.enrollment_type ?? "invite",
      contract_number: data.contract_number ?? null,
      contract_url: data.contract_url ?? null,
      contract_file_name: data.contract_file_name ?? null,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Classes POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ class: created }, { status: 201 });
}

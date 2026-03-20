import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ILTSessionsClient, {
  type SessionItem,
  type AttendeeItem,
  type CourseOption,
  type InstructorOption,
} from "./ilt-sessions-client";

export default async function AdminILTSessionsPage() {
  const supabase = await createClient();

  // ─── Auth ─────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify user exists in users table
  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  // ─── Fetch sessions with course + instructor joins ────────────
  const { data: sessionsRows } = await service
    .from("ilt_sessions")
    .select(
      "*, course:courses(id, title), instructor:users!ilt_sessions_instructor_id_fkey(id, first_name, last_name, email)"
    )
    .order("session_date", { ascending: false });

  // ─── Fetch attendance records for all sessions ────────────────
  const { data: attendanceRows } = await service
    .from("ilt_attendance")
    .select(
      "*, user:users!ilt_attendance_user_id_fkey(id, first_name, last_name, email)"
    );

  // ─── Fetch courses for the create-session dropdown ────────────
  const { data: coursesRows } = await service
    .from("courses")
    .select("id, title")
    .order("title");

  // ─── Fetch instructors (users who could instruct) ─────────────
  const { data: instructorsRows } = await service
    .from("users")
    .select("id, first_name, last_name")
    .order("last_name");

  // ─── Transform data ──────────────────────────────────────────

  // Group attendance by session_id
  const attendanceBySession: Record<string, AttendeeItem[]> = {};
  const registeredCountBySession: Record<string, number> = {};

  for (const row of attendanceRows ?? []) {
    const r = row as any;
    const sessionId = r.session_id;
    if (!attendanceBySession[sessionId]) {
      attendanceBySession[sessionId] = [];
      registeredCountBySession[sessionId] = 0;
    }

    if (r.registration_status === "registered") {
      registeredCountBySession[sessionId] = (registeredCountBySession[sessionId] || 0) + 1;
    }

    const u = r.user;
    attendanceBySession[sessionId].push({
      id: r.id,
      name: u ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() : "Unknown",
      email: u?.email ?? "",
      attendance_status: r.attendance_status ?? null,
      check_in_time: null,
      notes: "",
    });
  }

  const sessions: SessionItem[] = (sessionsRows ?? []).map((row: any) => {
    const course = row.course;
    const instructor = row.instructor;
    const sessionId = row.id;

    return {
      id: sessionId,
      course_id: row.course_id ?? "",
      course_title: course?.title ?? "Unknown Course",
      title: row.title ?? "",
      description: row.description ?? "",
      instructor_name: instructor
        ? `${instructor.first_name ?? ""} ${instructor.last_name ?? ""}`.trim()
        : "TBD",
      session_date: row.session_date ?? "",
      start_time: row.start_time ? row.start_time.slice(0, 5) : "",
      end_time: row.end_time ? row.end_time.slice(0, 5) : "",
      timezone: row.timezone ?? "America/New_York",
      location_type: row.location_type ?? "virtual",
      location_details: row.location_details ?? "",
      meeting_url: row.meeting_url ?? null,
      meeting_provider: row.meeting_provider ?? null,
      meeting_id: row.meeting_id ?? null,
      meeting_password: row.meeting_password ?? null,
      recording_url: row.recording_url ?? null,
      max_capacity: row.max_capacity ?? 30,
      registered_count: registeredCountBySession[sessionId] ?? 0,
      status: row.status ?? "scheduled",
      attendees: attendanceBySession[sessionId] ?? [],
    };
  });

  const courses: CourseOption[] = (coursesRows ?? []).map((c: any) => ({
    id: c.id,
    title: c.title ?? "Untitled",
  }));

  const instructors: InstructorOption[] = (instructorsRows ?? []).map((u: any) => ({
    id: u.id,
    name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Unknown",
  }));

  return (
    <ILTSessionsClient
      initialSessions={sessions}
      courses={courses}
      instructors={instructors}
    />
  );
}

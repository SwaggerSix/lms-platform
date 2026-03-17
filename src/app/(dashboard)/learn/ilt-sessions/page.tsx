import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ILTSessionsClient from "./ilt-sessions-client";
import type { LearnerSession } from "./ilt-sessions-client";

export const metadata: Metadata = {
  title: "Live Sessions | LMS Platform",
  description: "Browse and register for instructor-led training sessions",
};

export default async function LearnerILTSessionsPage() {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  // Fetch user profile from users table
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const userId = profile.id;

  // Fetch all ILT sessions with course and instructor joins
  const { data: rawSessions, error } = await supabase
    .from("ilt_sessions")
    .select(
      "id, title, description, session_date, start_time, end_time, timezone, location_type, location_details, meeting_url, max_capacity, status, course:courses(title), instructor:users!ilt_sessions_instructor_id_fkey(first_name, last_name)"
    )
    .in("status", ["scheduled", "in_progress", "completed"])
    .order("session_date", { ascending: true });

  if (error) {
    console.error("Failed to fetch ILT sessions:", error.message);
  }

  const sessionIds = (rawSessions ?? []).map((s) => s.id);

  // Fetch registration counts for all sessions
  const { data: registrationCounts } = sessionIds.length > 0
    ? await supabase
        .from("ilt_attendance")
        .select("session_id")
        .in("session_id", sessionIds)
        .eq("registration_status", "registered")
    : { data: [] };

  // Build a count map: session_id -> number of registered attendees
  const countMap: Record<string, number> = {};
  for (const row of registrationCounts ?? []) {
    countMap[row.session_id] = (countMap[row.session_id] || 0) + 1;
  }

  // Fetch current user's attendance records for all sessions
  const { data: userAttendance } = sessionIds.length > 0
    ? await supabase
        .from("ilt_attendance")
        .select("session_id, registration_status, attendance_status")
        .eq("user_id", userId)
        .in("session_id", sessionIds)
    : { data: [] };

  // Build maps for the current user's registration and attendance
  const userAttendanceMap: Record<string, { registration_status: string; attendance_status: string | null }> = {};
  for (const row of userAttendance ?? []) {
    userAttendanceMap[row.session_id] = {
      registration_status: row.registration_status,
      attendance_status: row.attendance_status,
    };
  }

  // Map raw sessions to the LearnerSession interface
  const sessions: LearnerSession[] = (rawSessions ?? []).map((s) => {
    const rawCourse = s.course as any;
    const course = Array.isArray(rawCourse) ? rawCourse[0] : rawCourse;
    const rawInstructor = s.instructor as any;
    const instructor = Array.isArray(rawInstructor) ? rawInstructor[0] : rawInstructor;

    const userRecord = userAttendanceMap[s.id];
    const isRegistered = userRecord?.registration_status === "registered";
    const attendanceStatus = (userRecord?.attendance_status as LearnerSession["attendance_status"]) ?? null;

    // Determine completion status based on session status and attendance
    let completionStatus: LearnerSession["completion_status"] = null;
    if (s.status === "completed" && isRegistered) {
      completionStatus = attendanceStatus === "absent" || attendanceStatus === "no_show" ? "not_started" : "completed";
    }

    return {
      id: s.id,
      course_title: course?.title ?? "Untitled Course",
      session_title: s.title,
      instructor_name: instructor ? `${instructor.first_name} ${instructor.last_name}` : "Unknown Instructor",
      session_date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      timezone: s.timezone ?? "America/New_York",
      location_type: s.location_type as LearnerSession["location_type"],
      location_details: s.location_details ?? "",
      meeting_url: s.meeting_url ?? null,
      max_capacity: s.max_capacity ?? 30,
      registered_count: countMap[s.id] ?? 0,
      status: s.status as LearnerSession["status"],
      is_registered: isRegistered,
      attendance_status: attendanceStatus,
      completion_status: completionStatus,
    };
  });

  return <ILTSessionsClient sessions={sessions} />;
}

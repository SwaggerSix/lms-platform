import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import IltSessionsLogClient, { type SessionRow } from "./ilt-sessions-log-client";

export const metadata: Metadata = {
  title: "ILT Session Log | LMS Platform",
  description: "Log of all instructor-led training sessions (imported from GEMS).",
};

// Always fresh — this page reflects the live ilt_sessions table.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function IltSessionsLogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser || (dbUser.role !== "admin" && dbUser.role !== "super_admin")) {
    redirect("/dashboard");
  }

  const { data: rows } = await service
    .from("ilt_sessions")
    .select(
      "id, title, description, session_date, start_time, end_time, timezone, location_type, location_details, status, max_capacity, external_source, external_id, external_synced_at, instructor_name, instructor_email, course:courses(id, title, slug, metadata), instructor:users!ilt_sessions_instructor_id_fkey(id, first_name, last_name, email)"
    )
    .order("session_date", { ascending: false })
    .limit(500);

  const sessions: SessionRow[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    session_date: r.session_date,
    start_time: r.start_time ?? null,
    end_time: r.end_time ?? null,
    timezone: r.timezone ?? null,
    location_type: r.location_type ?? null,
    location_details: r.location_details ?? null,
    status: r.status ?? null,
    max_capacity: r.max_capacity ?? null,
    external_source: r.external_source ?? null,
    external_id: r.external_id ?? null,
    external_synced_at: r.external_synced_at ?? null,
    course_title: r.course?.title ?? null,
    course_code: (r.course?.metadata?.gems_course_code as string | undefined) ?? null,
    instructor_name:
      (r.instructor
        ? `${r.instructor.first_name ?? ""} ${r.instructor.last_name ?? ""}`.trim()
        : null) ||
      r.instructor_name ||
      null,
    instructor_email: r.instructor?.email ?? r.instructor_email ?? null,
  }));

  return <IltSessionsLogClient initialSessions={sessions} />;
}

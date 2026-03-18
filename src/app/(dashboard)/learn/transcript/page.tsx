import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import TranscriptClient from "./transcript-client";
import type { TranscriptRecord, TranscriptUser } from "./transcript-client";

export const metadata: Metadata = {
  title: "Transcript | LMS Platform",
  description: "View your complete learning history and official transcript",
};

export default async function TranscriptPage() {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  // Fetch user profile from users table
  const service = createServiceClient();
  const { data: profile, error: profileError } = await service
    .from("users")
    .select("id, first_name, last_name, email, job_title, hire_date, manager_id, organization:organizations(name)")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile || profileError) {
    console.error("Transcript profile fetch failed:", profileError?.message);
    redirect("/login");
  }

  // Fetch manager name separately to avoid self-join issues
  let managerName = "N/A";
  if (profile.manager_id) {
    const { data: mgr } = await service
      .from("users")
      .select("first_name, last_name")
      .eq("id", profile.manager_id)
      .single();
    if (mgr) {
      managerName = `${mgr.first_name} ${mgr.last_name}`;
    }
  }

  const org = profile.organization as any;
  const orgName = Array.isArray(org) ? org[0]?.name : org?.name;

  const transcriptUser: TranscriptUser = {
    name: `${profile.first_name} ${profile.last_name}`,
    employee_id: `EMP-${profile.id.slice(0, 8).toUpperCase()}`,
    department: orgName ?? "N/A",
    job_title: profile.job_title ?? "N/A",
    manager: managerName,
    email: profile.email,
    hire_date: profile.hire_date ?? "",
  };

  // Fetch enrollments with course data (mirrors the API route pattern)
  const { data: enrollments, error } = await service
    .from("enrollments")
    .select("id, status, enrolled_at, completed_at, score, certificate_issued, course:courses(title, course_type, estimated_duration)")
    .eq("user_id", profile.id)
    .order("enrolled_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch transcript enrollments:", error.message);
  }

  // Map enrollments to the TranscriptRecord interface
  const records: TranscriptRecord[] = (enrollments ?? []).map((e) => {
    const rawCourse = e.course as any;
    const course = Array.isArray(rawCourse) ? rawCourse[0] : rawCourse;
    return {
      id: e.id,
      course_title: course?.title ?? "Unknown Course",
      course_type: (course?.course_type ?? "self_paced") as TranscriptRecord["course_type"],
      enrollment_date: e.enrolled_at ? new Date(e.enrolled_at).toISOString().split("T")[0] : "",
      completion_date: e.completed_at ? new Date(e.completed_at).toISOString().split("T")[0] : null,
      status: e.status,
      score: e.score != null ? Number(e.score) : null,
      credits: course?.estimated_duration ? Math.round((course.estimated_duration / 60) * 10) / 10 : 0,
      certificate_id: e.certificate_issued ? e.id : null,
    };
  });

  return <TranscriptClient user={transcriptUser} records={records} />;
}

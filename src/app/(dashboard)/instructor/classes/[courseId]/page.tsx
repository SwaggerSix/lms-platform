import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { instructorCanAccessCourse } from "@/lib/instructor/instructor-queries";
import ClassDetailClient, {
  type ClassDetailData,
} from "./class-detail-client";

export const metadata: Metadata = {
  title: "Class | LMS Platform",
};

export default async function InstructorClassDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");

  const isPrivileged = ["admin", "super_admin"].includes(dbUser.role);
  if (dbUser.role !== "instructor" && !isPrivileged) {
    redirect("/dashboard");
  }
  // Instructors may only open courses they are responsible for.
  if (
    dbUser.role === "instructor" &&
    !(await instructorCanAccessCourse(dbUser.id, courseId, service))
  ) {
    redirect("/instructor/classes");
  }

  const { data: course } = await service
    .from("courses")
    .select(
      "id, title, slug, description, short_description, course_type, status, difficulty_level, estimated_duration"
    )
    .eq("id", courseId)
    .single();
  if (!course) redirect("/instructor/classes");

  const [modulesRes, sessionsRes, enrollmentsRes, templatesRes, triggersRes] =
    await Promise.all([
      service
        .from("modules")
        .select("id, title, description, sequence_order")
        .eq("course_id", courseId)
        .order("sequence_order", { ascending: true }),
      service
        .from("ilt_sessions")
        .select("*, ilt_attendance(*)")
        .eq("course_id", courseId)
        .order("session_date", { ascending: true }),
      service
        .from("enrollments")
        .select(
          "id, status, enrolled_at, score, user:users(id, first_name, last_name, email, job_title)"
        )
        .eq("course_id", courseId),
      service
        .from("evaluation_templates")
        .select("id, name, level, description")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      service
        .from("evaluation_triggers")
        .select("*, template:evaluation_templates(id, name, level)")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false }),
    ]);

  const moduleIds = (modulesRes.data ?? []).map((m: any) => m.id);
  const { data: lessonRows } = moduleIds.length
    ? await service
        .from("lessons")
        .select("id, module_id, title, content_type, content_url, duration, sequence_order")
        .in("module_id", moduleIds)
        .order("sequence_order", { ascending: true })
    : { data: [] as any[] };

  const modules = (modulesRes.data ?? []).map((m: any) => ({
    id: m.id,
    title: m.title,
    description: m.description ?? "",
    lessons: (lessonRows ?? [])
      .filter((l: any) => l.module_id === m.id)
      .map((l: any) => ({
        id: l.id,
        title: l.title,
        contentType: l.content_type,
        contentUrl: l.content_url ?? null,
        duration: l.duration ?? null,
      })),
  }));

  const participants = (enrollmentsRes.data ?? [])
    .map((e: any) => ({
      enrollmentId: e.id,
      userId: e.user?.id ?? null,
      name: `${e.user?.first_name ?? ""} ${e.user?.last_name ?? ""}`.trim() || "Unknown",
      email: e.user?.email ?? "",
      jobTitle: e.user?.job_title ?? "",
      status: e.status,
      score: e.score ?? null,
    }))
    .filter((p) => p.userId);

  const sessions = (sessionsRes.data ?? []).map((s: any) => ({
    id: s.id,
    title: s.title,
    sessionDate: s.session_date ?? null,
    startTime: s.start_time ?? null,
    endTime: s.end_time ?? null,
    timezone: s.timezone ?? null,
    locationType: s.location_type ?? null,
    locationDetails: s.location_details ?? null,
    meetingUrl: s.meeting_url ?? null,
    status: s.status ?? "scheduled",
    maxCapacity: s.max_capacity ?? null,
    attendeeCount: Array.isArray(s.ilt_attendance) ? s.ilt_attendance.length : 0,
  }));

  const data: ClassDetailData = {
    course: {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description ?? "",
      shortDescription: course.short_description ?? "",
      courseType: course.course_type,
      status: course.status,
      difficulty: course.difficulty_level,
      estimatedDuration: course.estimated_duration ?? null,
    },
    modules,
    sessions,
    participants,
    evaluationTemplates: (templatesRes.data ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      level: t.level,
      description: t.description ?? "",
    })),
    evaluationTriggers: (triggersRes.data ?? []).map((t: any) => ({
      id: t.id,
      templateId: t.template_id,
      templateName: t.template?.name ?? "Evaluation",
      level: t.template?.level ?? null,
      delayDays: t.delay_days ?? 0,
      isActive: t.is_active ?? true,
    })),
  };

  return <ClassDetailClient data={data} />;
}

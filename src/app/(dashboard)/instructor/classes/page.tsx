import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getInstructorCourseIds } from "@/lib/instructor/instructor-queries";
import ClassesClient, { type InstructorClass } from "./classes-client";

export const metadata: Metadata = {
  title: "My Classes | LMS Platform",
  description: "Courses and classes you teach",
};

export default async function InstructorClassesPage() {
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
  if (!["instructor", "admin", "super_admin"].includes(dbUser.role)) {
    redirect("/dashboard");
  }

  const courseIds = await getInstructorCourseIds(dbUser.id, service);

  if (courseIds.length === 0) {
    return <ClassesClient classes={[]} />;
  }

  // Fetch the courses, their enrollment counts, and their scheduled sessions.
  const [coursesResult, enrollmentsResult, sessionsResult] = await Promise.all([
    service
      .from("courses")
      .select(
        "id, title, slug, short_description, thumbnail_url, course_type, status, difficulty_level"
      )
      .in("id", courseIds),
    service.from("enrollments").select("course_id, status").in("course_id", courseIds),
    service
      .from("ilt_sessions")
      .select("course_id, session_date, start_time, status, title")
      .in("course_id", courseIds)
      .order("session_date", { ascending: true }),
  ]);

  const enrollmentCounts: Record<string, number> = {};
  for (const e of enrollmentsResult.data ?? []) {
    enrollmentCounts[e.course_id] = (enrollmentCounts[e.course_id] ?? 0) + 1;
  }

  const now = Date.now();
  const sessionMeta: Record<
    string,
    { count: number; nextDate: string | null }
  > = {};
  for (const s of sessionsResult.data ?? []) {
    const meta = (sessionMeta[s.course_id] ??= { count: 0, nextDate: null });
    meta.count += 1;
    // First upcoming, non-cancelled session becomes the "next" date.
    if (
      s.session_date &&
      s.status !== "cancelled" &&
      new Date(s.session_date).getTime() >= now &&
      meta.nextDate === null
    ) {
      meta.nextDate = s.session_date;
    }
  }

  const classes: InstructorClass[] = (coursesResult.data ?? []).map((c: any) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    shortDescription: c.short_description ?? "",
    thumbnailUrl: c.thumbnail_url ?? null,
    courseType: c.course_type,
    status: c.status,
    difficulty: c.difficulty_level,
    participantCount: enrollmentCounts[c.id] ?? 0,
    sessionCount: sessionMeta[c.id]?.count ?? 0,
    nextSessionDate: sessionMeta[c.id]?.nextDate ?? null,
  }));

  // Show courses with imminent sessions first, then alphabetically.
  classes.sort((a, b) => {
    if (a.nextSessionDate && b.nextSessionDate) {
      return a.nextSessionDate.localeCompare(b.nextSessionDate);
    }
    if (a.nextSessionDate) return -1;
    if (b.nextSessionDate) return 1;
    return a.title.localeCompare(b.title);
  });

  return <ClassesClient classes={classes} />;
}

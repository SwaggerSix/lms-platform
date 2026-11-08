import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getInstructorCourseIds } from "@/lib/instructor/instructor-queries";
import ScormManageClient, { type ScormLessonRow } from "./scorm-client";

export const metadata: Metadata = {
  title: "SCORM Packages | LMS Platform",
  description: "Upload, replace, preview and publish SCORM e-learning packages",
};

export default async function CourseScormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service.from("users").select("id, role").eq("auth_id", user.id).single();
  if (!dbUser || !["admin", "super_admin", "instructor"].includes(dbUser.role)) {
    redirect("/dashboard");
  }

  const { data: course } = await service
    .from("courses")
    .select(
      "id, title, slug, status, created_by, modules(id, title, sequence_order, lessons(id, title, content_type, content_url, content_data, sequence_order))"
    )
    .eq("slug", slug)
    .single();
  if (!course) redirect("/admin/courses");

  if (dbUser.role === "instructor") {
    const ids = await getInstructorCourseIds(dbUser.id, service);
    if (!ids.includes(course.id)) redirect("/instructor/classes");
  }

  const { data: currentVersion } = await service
    .from("course_versions")
    .select("version_number, published_at")
    .eq("course_id", course.id)
    .eq("is_current", true)
    .maybeSingle();

  const modules = [...((course as any).modules ?? [])].sort(
    (a: any, b: any) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)
  );
  const lessons: ScormLessonRow[] = [];
  let totalLessons = 0;
  for (const m of modules) {
    const ls = [...(m.lessons ?? [])].sort((a: any, b: any) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
    totalLessons += ls.length;
    for (const l of ls) {
      if (l.content_type !== "scorm") continue;
      const meta = (l.content_data as any)?.scorm ?? null;
      lessons.push({
        id: l.id,
        title: l.title,
        moduleTitle: m.title,
        contentUrl: l.content_url,
        version: meta?.version ?? null,
        fileName: meta?.file_name ?? null,
        fileCount: meta?.file_count ?? null,
        uploadedAt: meta?.uploaded_at ?? null,
      });
    }
  }

  return (
    <ScormManageClient
      course={{ id: course.id, title: course.title, slug: course.slug, status: course.status }}
      lessons={lessons}
      totalLessons={totalLessons}
      currentVersion={currentVersion?.version_number ?? null}
      canEdit={dbUser.role !== "instructor" || course.created_by === dbUser.id}
    />
  );
}

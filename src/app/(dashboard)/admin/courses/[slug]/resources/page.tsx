import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getInstructorCourseIds } from "@/lib/instructor/instructor-queries";
import CourseResourcesClient, { type CourseResource } from "./resources-client";

export const metadata: Metadata = {
  title: "Course Content | LMS Platform",
  description: "Add presentation decks, videos, guides, and materials to a course",
};

export default async function CourseResourcesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser || !["admin", "super_admin", "instructor"].includes(dbUser.role)) {
    redirect("/dashboard");
  }

  const { data: course } = await service
    .from("courses")
    .select("id, title, slug")
    .eq("slug", slug)
    .single();
  if (!course) redirect("/admin/courses");

  // Instructors may only manage their own courses.
  if (dbUser.role === "instructor") {
    const ids = await getInstructorCourseIds(dbUser.id, service);
    if (!ids.includes(course.id)) redirect("/instructor/classes");
  }

  const { data: rows } = await service
    .from("course_resources")
    .select("*")
    .eq("course_id", course.id)
    .order("created_at", { ascending: true });

  const resources: CourseResource[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    resourceType: r.resource_type,
    audience: r.audience,
    fileUrl: r.file_url,
    fileName: r.file_name,
    fileType: r.file_type,
  }));

  return (
    <CourseResourcesClient
      courseId={course.id}
      courseTitle={course.title}
      courseSlug={course.slug}
      initialResources={resources}
    />
  );
}

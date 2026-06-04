import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CourseMappingClient from "./course-mapping-client";

export const metadata: Metadata = {
  title: "GEMS Course Mapping | LMS Platform",
  description: "Map existing LMS courses to GEMS course codes so the sync matches by code instead of creating duplicates.",
};

export default async function GemsCourseMappingPage() {
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

  const { data: courses } = await service
    .from("courses")
    .select("id, title, slug, course_type, status, metadata")
    .neq("status", "archived")
    .order("title", { ascending: true });

  const courseRows = (courses ?? []).map((c) => ({
    id: c.id as string,
    title: c.title as string,
    slug: c.slug as string,
    course_type: (c.course_type ?? null) as string | null,
    status: (c.status ?? null) as string | null,
    gems_course_code:
      (((c.metadata as Record<string, unknown> | null) ?? {})["gems_course_code"] as
        | string
        | undefined) ?? null,
  }));

  return <CourseMappingClient initialCourses={courseRows} />;
}

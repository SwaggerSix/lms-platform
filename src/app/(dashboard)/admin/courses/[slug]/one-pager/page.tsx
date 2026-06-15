import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import OnePagerClient from "./one-pager-client";

export const metadata: Metadata = { title: "Course One-Pager | LMS Platform" };

export default async function CourseOnePagerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await service.from("users").select("role").eq("auth_id", user.id).single();
  if (!profile || !["admin", "super_admin", "instructor"].includes(profile.role)) redirect("/dashboard");

  const { data: course } = await service
    .from("courses")
    .select("*, category:categories(name)")
    .eq("slug", slug)
    .single();
  if (!course) notFound();

  const metadata = (course.metadata as Record<string, any>) || {};
  const objectives: string[] = metadata.learning_outcomes || metadata.learningOutcomes || [];
  const category = Array.isArray(course.category) ? course.category[0] : (course.category as any);

  const minutes = course.estimated_duration ?? null;
  const durationText = minutes
    ? minutes >= 60
      ? `${Math.round((minutes / 60) * 10) / 10} hours`
      : `${minutes} minutes`
    : null;

  return (
    <OnePagerClient
      data={{
        title: course.title,
        description: course.description || course.short_description || "",
        domain: category?.name ?? null,
        durationText,
        difficulty: course.difficulty_level ?? null,
        objectives,
        nasba: course.nasba_certified
          ? {
              cpe_credits: course.nasba_cpe_credits ?? null,
              field_of_study: course.nasba_field_of_study ?? null,
              knowledge_level: course.nasba_knowledge_level ?? null,
              prerequisites: course.nasba_prerequisites ?? null,
              advance_prep: course.nasba_advance_prep ?? null,
              delivery_method: course.nasba_delivery_method ?? null,
            }
          : null,
      }}
    />
  );
}

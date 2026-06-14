import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import AdminClassesClient from "./admin-classes-client";

export const metadata: Metadata = {
  title: "Classes | LMS Platform",
  description: "Schedule classes and invite participants",
};

export default async function AdminClassesPage() {
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!profile || !["admin", "super_admin", "instructor"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const [{ data: courses }, { data: instructors }] = await Promise.all([
    service
      .from("courses")
      .select("id, title")
      .in("course_type", ["instructor_led", "blended"])
      .order("title", { ascending: true }),
    service
      .from("users")
      .select("id, first_name, last_name")
      .in("role", ["instructor", "admin", "super_admin"])
      .order("first_name", { ascending: true }),
  ]);

  return (
    <AdminClassesClient
      courses={courses ?? []}
      instructors={(instructors ?? []).map((i) => ({
        id: i.id,
        name: `${i.first_name} ${i.last_name}`,
      }))}
    />
  );
}

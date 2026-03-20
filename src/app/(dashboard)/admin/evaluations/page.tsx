import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import EvaluationsAdminClient from "./evaluations-admin-client";

export const metadata: Metadata = {
  title: "Training Evaluations | LMS Platform",
  description: "Manage evaluation templates and course survey triggers",
};

export default async function EvaluationsAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser || !["admin", "super_admin"].includes(dbUser.role)) {
    redirect("/learn/dashboard");
  }

  const [{ data: templates }, { data: triggers }, { data: courses }] = await Promise.all([
    service
      .from("evaluation_templates")
      .select("id, name, description, level, is_active, created_at")
      .order("created_at", { ascending: false }),
    service
      .from("evaluation_triggers")
      .select(`
        id, delay_days, is_active, created_at,
        course:courses(id, title),
        template:evaluation_templates(id, name, level)
      `)
      .order("created_at", { ascending: false }),
    service
      .from("courses")
      .select("id, title")
      .eq("status", "published")
      .order("title", { ascending: true }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asAny = (v: unknown) => v as any;
  return (
    <EvaluationsAdminClient
      templates={asAny(templates ?? [])}
      triggers={asAny(triggers ?? [])}
      courses={asAny(courses ?? [])}
    />
  );
}

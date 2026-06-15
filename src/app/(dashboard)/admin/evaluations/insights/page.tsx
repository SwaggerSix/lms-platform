import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import InsightsClient, { type Facet } from "./insights-client";

export const metadata: Metadata = {
  title: "Evaluation Insights | LMS Platform",
  description: "Filterable evaluation reporting for insight and marketing",
};

export default async function EvaluationInsightsPage() {
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await service
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();
  if (!profile || !["admin", "super_admin", "instructor", "manager"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // Derive filter options from the responses that actually exist.
  const { data: rows } = await service
    .from("evaluation_report_rows")
    .select("course_id, course_title, category_id, category_name, instructor_id, instructor_name, tenant_id, client_name")
    .limit(5000);

  const dedupe = (
    items: { id: unknown; label: unknown }[]
  ): Facet[] => {
    const map = new Map<string, string>();
    for (const i of items) {
      if (i.id && i.label) map.set(String(i.id), String(i.label));
    }
    return [...map.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  };

  const courses = dedupe((rows ?? []).map((r) => ({ id: r.course_id, label: r.course_title })));
  const domains = dedupe((rows ?? []).map((r) => ({ id: r.category_id, label: r.category_name })));
  const instructors = dedupe((rows ?? []).map((r) => ({ id: r.instructor_id, label: r.instructor_name })));
  const clients = dedupe((rows ?? []).map((r) => ({ id: r.tenant_id, label: r.client_name })));

  return (
    <InsightsClient courses={courses} domains={domains} instructors={instructors} clients={clients} />
  );
}

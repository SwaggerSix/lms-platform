import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import EvaluationReportClient from "./evaluation-report-client";

export const metadata: Metadata = {
  title: "Evaluation Report | LMS Platform",
};

export default async function EvaluationReportPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser || !["admin", "super_admin", "manager"].includes(dbUser.role)) {
    redirect("/learn/dashboard");
  }

  const [{ data: course }, { data: assignments }] = await Promise.all([
    service.from("courses").select("id, title").eq("id", courseId).single(),
    service
      .from("evaluation_assignments")
      .select(`
        id, status, completed_at,
        user:users(id, first_name, last_name, email),
        template:evaluation_templates(id, name, level, questions),
        response:evaluation_responses(id, answers, submitted_at)
      `)
      .eq("course_id", courseId)
      .order("created_at", { ascending: false }),
  ]);

  if (!course) redirect("/admin/evaluations");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asAny = (v: unknown) => v as any;
  return (
    <EvaluationReportClient
      course={asAny(course)}
      assignments={asAny(assignments ?? [])}
    />
  );
}

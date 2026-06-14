import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ResultsClient from "./results-client";

export const metadata: Metadata = {
  title: "Examination Results | LMS Platform",
  description: "Per-learner examination scores and pass/fail records",
};

export default async function AssessmentResultsPage() {
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await service
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();
  if (!profile || !["admin", "super_admin", "instructor"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const { data: assessments } = await service
    .from("assessments")
    .select("id, title")
    .order("title", { ascending: true });

  return <ResultsClient assessments={assessments ?? []} />;
}

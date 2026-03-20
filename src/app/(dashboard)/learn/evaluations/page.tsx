import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import EvaluationsLearnerClient from "./evaluations-learner-client";

export const metadata: Metadata = {
  title: "My Evaluations | LMS Platform",
  description: "Complete your post-training evaluations",
};

export default async function EvaluationsLearnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) redirect("/login");

  const { data: assignments } = await service
    .from("evaluation_assignments")
    .select(`
      id, status, due_at, completed_at, created_at,
      template:evaluation_templates(id, name, description, level, questions),
      course:courses(id, title, thumbnail_url)
    `)
    .eq("user_id", dbUser.id)
    .order("created_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <EvaluationsLearnerClient assignments={(assignments ?? []) as any} />;
}

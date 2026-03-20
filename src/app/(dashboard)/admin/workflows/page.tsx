import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import WorkflowListClient from "./workflow-list-client";

export const metadata: Metadata = {
  title: "Workflows | LMS Platform",
  description: "Build and manage automation workflows",
};

export default async function WorkflowsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser || dbUser.role !== "admin" && dbUser.role !== "super_admin") redirect("/dashboard");

  const { data: workflows } = await service
    .from("workflows")
    .select("*")
    .order("created_at", { ascending: false });

  return <WorkflowListClient initialWorkflows={workflows ?? []} />;
}

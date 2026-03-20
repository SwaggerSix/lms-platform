import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import WorkflowEditorClient from "./workflow-editor-client";

export const metadata: Metadata = {
  title: "Workflow Editor | LMS Platform",
  description: "Visual workflow builder",
};

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: workflow } = await service
    .from("workflows")
    .select("*")
    .eq("id", id)
    .single();

  if (!workflow) redirect("/admin/workflows");

  const { data: steps } = await service
    .from("workflow_steps")
    .select("*")
    .eq("workflow_id", id)
    .order("sequence_order", { ascending: true });

  return (
    <WorkflowEditorClient
      workflow={workflow}
      initialSteps={steps ?? []}
    />
  );
}

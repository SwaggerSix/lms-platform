import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import WorkflowRunsClient from "./workflow-runs-client";

export const metadata: Metadata = {
  title: "Workflow Run History | LMS Platform",
  description: "View workflow execution history",
};

export default async function WorkflowRunsPage({
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
    .select("id, name")
    .eq("id", id)
    .single();

  if (!workflow) redirect("/admin/workflows");

  const { data: runs } = await service
    .from("workflow_runs")
    .select("*")
    .eq("workflow_id", id)
    .order("started_at", { ascending: false })
    .limit(50);

  // Fetch step logs for each run
  const runsWithLogs = await Promise.all(
    (runs ?? []).map(async (run) => {
      const { data: stepLogs } = await service
        .from("workflow_step_logs")
        .select("*, workflow_steps(step_type, step_config)")
        .eq("run_id", run.id)
        .order("started_at", { ascending: true });
      return { ...run, step_logs: stepLogs ?? [] };
    })
  );

  return (
    <WorkflowRunsClient
      workflow={workflow}
      initialRuns={runsWithLogs}
    />
  );
}

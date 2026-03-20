import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

// GET: Get run history for a workflow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
  const offset = Number(searchParams.get("offset") || 0);
  const status = searchParams.get("status");

  const service = createServiceClient();

  let query = service
    .from("workflow_runs")
    .select("*")
    .eq("workflow_id", id)
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data: runs, error } = await query;

  if (error) {
    console.error("Workflow runs API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // For each run, fetch step logs
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

  return NextResponse.json({ runs: runsWithLogs });
}

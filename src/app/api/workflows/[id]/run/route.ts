import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { WorkflowEngine } from "@/lib/workflows/engine";
import { NextRequest, NextResponse } from "next/server";

// POST: Manually trigger a workflow run
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`workflow-run-${auth.user.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const { id } = await params;
  const service = createServiceClient();

  // Verify workflow exists and is active
  const { data: workflow, error } = await service
    .from("workflows")
    .select("id, name, is_active")
    .eq("id", id)
    .single();

  if (error || !workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  if (!workflow.is_active) {
    return NextResponse.json({ error: "Workflow is not active" }, { status: 400 });
  }

  // Parse optional trigger data from body
  let triggerData: Record<string, unknown> = {};
  try {
    const body = await request.json();
    triggerData = body.trigger_data || body || {};
  } catch {
    // No body is fine for manual triggers
  }

  triggerData.triggered_by = auth.user.id;
  triggerData.trigger_source = "manual";

  const engine = new WorkflowEngine();

  try {
    const run = await engine.executeWorkflow(id, triggerData);

    logAudit({
      userId: auth.user.id,
      action: "executed",
      entityType: "workflow",
      entityId: id,
      newValues: { run_id: run.id, status: run.status },
    });

    return NextResponse.json(run);
  } catch (err) {
    console.error("Workflow execution error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

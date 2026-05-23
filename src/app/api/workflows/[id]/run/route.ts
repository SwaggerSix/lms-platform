import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { WorkflowEngine } from "@/lib/workflows/engine";
import { NextRequest, NextResponse } from "next/server";
import { jsonNoStore } from "@/lib/api/no-store";

// POST: Manually trigger a workflow run
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`workflow-run-${auth.user.id}`, 10, 60000);
  if (!rl.success) return jsonNoStore({ error: "Rate limit exceeded" }, { status: 429 });

  const { id } = await params;
  const service = createServiceClient();

  // Verify workflow exists and is active. Pull tenant_id too so the
  // audit row is scoped to the workflow's tenant rather than relying
  // on the actor→org trigger (which would attribute a super_admin
  // cross-tenant trigger to the wrong tenant).
  const { data: workflow, error } = await service
    .from("workflows")
    .select("id, name, is_active, tenant_id")
    .eq("id", id)
    .single();

  if (error || !workflow) {
    return jsonNoStore({ error: "Workflow not found" }, { status: 404 });
  }

  if (!workflow.is_active) {
    return jsonNoStore({ error: "Workflow is not active" }, { status: 400 });
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
      action: "workflow.execute",
      entityType: "workflow",
      entityId: id,
      newValues: { run_id: run.id, status: run.status },
      // Tag the audit row to the workflow's tenant, not the actor's,
      // so cross-tenant super_admin triggers attribute correctly.
      tenantId: (workflow as { tenant_id?: string }).tenant_id ?? undefined,
    });

    return jsonNoStore(run);
  } catch (err) {
    console.error("Workflow execution error:", err);
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
  }
}

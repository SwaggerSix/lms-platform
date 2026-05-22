import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { WorkflowEngine } from "@/lib/workflows/engine";
import { NextRequest, NextResponse } from "next/server";
import { jsonNoStore } from "@/lib/api/no-store";

// POST: External webhook trigger for a workflow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rl = await rateLimit(`workflow-webhook-${id}`, 30, 60000);
  if (!rl.success) return jsonNoStore({ error: "Rate limit exceeded" }, { status: 429 });

  const service = createServiceClient();

  // Verify workflow exists, is active, and is webhook-triggered
  const { data: workflow, error } = await service
    .from("workflows")
    .select("id, name, is_active, trigger_type, trigger_config")
    .eq("id", id)
    .single();

  if (error || !workflow) {
    return jsonNoStore({ error: "Workflow not found" }, { status: 404 });
  }

  if (!workflow.is_active) {
    return jsonNoStore({ error: "Workflow is not active" }, { status: 400 });
  }

  if (workflow.trigger_type !== "webhook") {
    return jsonNoStore({ error: "Workflow is not a webhook trigger" }, { status: 400 });
  }

  // Validate webhook secret (required)
  const config = workflow.trigger_config as Record<string, unknown>;
  if (!config.secret) {
    console.error(`Workflow ${id} has no webhook secret configured`);
    return jsonNoStore({ error: "Webhook not configured" }, { status: 403 });
  }
  const authHeader = request.headers.get("x-webhook-secret");
  if (authHeader !== config.secret) {
    return jsonNoStore({ error: "Invalid webhook secret" }, { status: 401 });
  }

  // Parse webhook payload
  let triggerData: Record<string, unknown> = {};
  try {
    triggerData = await request.json();
  } catch {
    // Empty body is acceptable
  }

  triggerData.trigger_source = "webhook";
  triggerData.webhook_received_at = new Date().toISOString();

  const engine = new WorkflowEngine();

  try {
    const run = await engine.executeWorkflow(id, triggerData);
    return jsonNoStore({ run_id: run.id, status: run.status });
  } catch (err) {
    console.error("Webhook workflow execution error:", err);
    return jsonNoStore(
      { error: "Workflow execution failed" },
      { status: 500 }
    );
  }
}

import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createWorkflowStepSchema, bulkUpdateStepsSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

// GET: List all steps for a workflow
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data, error } = await service
    .from("workflow_steps")
    .select("*")
    .eq("workflow_id", id)
    .order("sequence_order", { ascending: true });

  if (error) {
    console.error("Workflow steps API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ steps: data ?? [] });
}

// POST: Add a new step to a workflow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: workflowId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createWorkflowStepSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify the workflow exists
  const { data: workflow } = await service
    .from("workflows")
    .select("id")
    .eq("id", workflowId)
    .single();

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const { data, error } = await service
    .from("workflow_steps")
    .insert({
      workflow_id: workflowId,
      step_type: validation.data.step_type,
      step_config: validation.data.step_config,
      position_x: validation.data.position_x,
      position_y: validation.data.position_y,
      next_step_id: validation.data.next_step_id ?? null,
      true_step_id: validation.data.true_step_id ?? null,
      false_step_id: validation.data.false_step_id ?? null,
      sequence_order: validation.data.sequence_order,
    })
    .select()
    .single();

  if (error) {
    console.error("Workflow steps API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// PUT: Bulk update steps (positions, connections, configs)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: workflowId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(bulkUpdateStepsSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Update each step
  const results = [];
  for (const stepUpdate of validation.data.steps) {
    const { id, ...updates } = stepUpdate;
    const { data, error } = await service
      .from("workflow_steps")
      .update(updates)
      .eq("id", id)
      .eq("workflow_id", workflowId)
      .select()
      .single();

    if (error) {
      console.error(`Failed to update step ${id}:`, error.message);
      continue;
    }
    results.push(data);
  }

  // Update workflow timestamp
  await service
    .from("workflows")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", workflowId);

  return NextResponse.json({ steps: results });
}

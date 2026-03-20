import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, updateWorkflowSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

// GET: Get a single workflow with its steps
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data: workflow, error } = await service
    .from("workflows")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const { data: steps } = await service
    .from("workflow_steps")
    .select("*")
    .eq("workflow_id", id)
    .order("sequence_order", { ascending: true });

  return NextResponse.json({ ...workflow, steps: steps ?? [] });
}

// PUT: Update a workflow
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(updateWorkflowSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("workflows")
    .update({ ...validation.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    console.error("Workflows API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "workflow",
    entityId: id,
    newValues: validation.data,
  });

  return NextResponse.json(data);
}

// DELETE: Delete a workflow
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();
  const { error } = await service.from("workflows").delete().eq("id", id);

  if (error) {
    console.error("Workflows API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "deleted",
    entityType: "workflow",
    entityId: id,
  });

  return NextResponse.json({ message: "Workflow deleted" });
}

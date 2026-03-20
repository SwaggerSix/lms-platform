import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, updateEvaluationTriggerSchema } from "@/lib/validations";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(updateEvaluationTriggerSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("evaluation_triggers")
    .update(validation.data)
    .eq("id", id)
    .select(`*, course:courses(id, title), template:evaluation_templates(id, name, level)`)
    .single();

  if (error || !data) return NextResponse.json({ error: "Trigger not found" }, { status: 404 });

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { error } = await service
    .from("evaluation_triggers")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Evaluation trigger DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

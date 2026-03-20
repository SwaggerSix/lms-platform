import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, updateObservationTemplateSchema } from "@/lib/validations";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin", "manager", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data, error } = await service
    .from("observation_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ template: data });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin", "manager", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const validation = validateBody(updateObservationTemplateSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("observation_templates")
    .update(validation.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Observation template PUT error:", error.message);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  // Check if there are active observations using this template
  const { count } = await service
    .from("observations")
    .select("*", { count: "exact", head: true })
    .eq("template_id", id)
    .in("status", ["draft", "in_progress"]);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "Cannot delete template with active observations" },
      { status: 400 }
    );
  }

  const { error } = await service
    .from("observation_templates")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Observation template DELETE error:", error.message);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

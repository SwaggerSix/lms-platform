import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, updateFieldMappingsSchema } from "@/lib/validations";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data, error } = await service
    .from("integration_field_mappings")
    .select("*")
    .eq("integration_id", id)
    .order("source_field");

  if (error) {
    console.error("Field mappings GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ mappings: data });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const validation = validateBody(updateFieldMappingsSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Delete existing mappings and re-insert
  await service
    .from("integration_field_mappings")
    .delete()
    .eq("integration_id", id);

  const mappingsToInsert = validation.data.mappings.map((m) => ({
    integration_id: id,
    source_field: m.source_field,
    target_field: m.target_field,
    transform: m.transform || null,
    is_active: m.is_active ?? true,
  }));

  const { data, error } = await service
    .from("integration_field_mappings")
    .insert(mappingsToInsert)
    .select();

  if (error) {
    console.error("Field mappings PUT error:", error.message);
    return NextResponse.json({ error: "Failed to update mappings" }, { status: 500 });
  }

  return NextResponse.json({ mappings: data });
}

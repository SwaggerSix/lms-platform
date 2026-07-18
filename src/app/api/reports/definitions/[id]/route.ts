import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import {
  validateDefinitionSpec,
  type DefinitionSpec,
} from "@/lib/reports/custom";

/** Load a definition the caller is allowed to touch (own org or global). */
async function loadAccessible(
  service: ReturnType<typeof createServiceClient>,
  id: string,
  organizationId: string | null
) {
  const { data } = await service
    .from("report_definitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  if (
    data.organization_id &&
    organizationId &&
    data.organization_id !== organizationId
  ) {
    return null;
  }
  return data;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;

  const service = createServiceClient();
  const existing = await loadAccessible(service, id, auth.user.organization_id ?? null);
  if (!existing) {
    return NextResponse.json({ error: "Definition not found" }, { status: 404 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const spec: DefinitionSpec = {
    dataset: body?.dataset ?? existing.dataset,
    columns: body?.columns ?? existing.columns,
    filters: body?.filters ?? existing.filters,
    sort_by: body?.sort_by !== undefined ? body.sort_by : existing.sort_by,
    sort_dir: body?.sort_dir ?? existing.sort_dir,
  };
  const specError = validateDefinitionSpec(spec);
  if (specError) {
    return NextResponse.json({ error: specError }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    dataset: spec.dataset,
    columns: spec.columns,
    filters: spec.filters,
    sort_by: spec.sort_by,
    sort_dir: spec.sort_dir ?? "asc",
  };
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 200) {
      return NextResponse.json(
        { error: "name must be 1-200 chars" },
        { status: 400 }
      );
    }
    updates.name = name;
  }
  if (typeof body?.description === "string") {
    updates.description = body.description;
  }

  const { data, error } = await service
    .from("report_definitions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("Report definition update error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ definition: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;

  const service = createServiceClient();
  const existing = await loadAccessible(service, id, auth.user.organization_id ?? null);
  if (!existing) {
    return NextResponse.json({ error: "Definition not found" }, { status: 404 });
  }

  const { error } = await service.from("report_definitions").delete().eq("id", id);
  if (error) {
    console.error("Report definition delete error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import {
  REPORT_DATASETS,
  validateDefinitionSpec,
  type DefinitionSpec,
} from "@/lib/reports/custom";

/**
 * GET  /api/reports/definitions — list saved definitions visible to the
 *      caller's org (own-org + global), plus the dataset registry so the
 *      builder UI renders columns/filters from one source of truth.
 * POST /api/reports/definitions — create a definition.
 */

export async function GET() {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();
  let query = service
    .from("report_definitions")
    .select("*")
    .order("updated_at", { ascending: false });
  if (auth.user.organization_id) {
    query = query.or(
      `organization_id.eq.${auth.user.organization_id},organization_id.is.null`
    );
  }
  const { data, error } = await query;
  if (error) {
    console.error("Report definitions list error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ definitions: data ?? [], datasets: REPORT_DATASETS });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200) {
    return NextResponse.json(
      { error: "name is required (max 200 chars)" },
      { status: 400 }
    );
  }

  const spec: DefinitionSpec = {
    dataset: body?.dataset,
    columns: body?.columns,
    filters: body?.filters ?? {},
    sort_by: body?.sort_by ?? null,
    sort_dir: body?.sort_dir ?? "asc",
  };
  const specError = validateDefinitionSpec(spec);
  if (specError) {
    return NextResponse.json({ error: specError }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("report_definitions")
    .insert({
      organization_id: auth.user.organization_id ?? null,
      name,
      description: typeof body?.description === "string" ? body.description : "",
      dataset: spec.dataset,
      columns: spec.columns,
      filters: spec.filters,
      sort_by: spec.sort_by,
      sort_dir: spec.sort_dir ?? "asc",
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Report definition create error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ definition: data }, { status: 201 });
}

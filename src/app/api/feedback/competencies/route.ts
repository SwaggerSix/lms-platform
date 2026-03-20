import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createCompetencySchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const activeOnly = searchParams.get("active") !== "false";

  const service = createServiceClient();
  let query = service
    .from("feedback_competencies")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (activeOnly) query = query.eq("is_active", true);
  if (category) query = query.eq("category", category);

  const { data, error } = await query;

  if (error) {
    console.error("Competencies GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ competencies: data });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createCompetencySchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("feedback_competencies")
    .insert(validation.data)
    .select()
    .single();

  if (error) {
    console.error("Competencies POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

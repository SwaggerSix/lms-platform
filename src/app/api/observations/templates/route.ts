import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, createObservationTemplateSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const active = searchParams.get("active");

  let query = service
    .from("observation_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (category) query = query.eq("category", category);
  if (active === "true") query = query.eq("is_active", true);
  if (active === "false") query = query.eq("is_active", false);

  const { data, error } = await query;

  if (error) {
    console.error("Observation templates GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ templates: data });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`obs-template-create-${auth.user.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(createObservationTemplateSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("observation_templates")
    .insert({
      ...validation.data,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Observation template POST error:", error.message);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }

  return NextResponse.json({ template: data }, { status: 201 });
}

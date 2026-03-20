import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createEvaluationTriggerSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "super_admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");

  let query = service
    .from("evaluation_triggers")
    .select(`
      *,
      course:courses(id, title),
      template:evaluation_templates(id, name, level)
    `)
    .order("created_at", { ascending: false });

  if (courseId) query = query.eq("course_id", courseId);

  const { data, error } = await query;
  if (error) {
    console.error("Evaluation triggers GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ triggers: data });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`eval-trigger-create-${auth.user.id}`, 30, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createEvaluationTriggerSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("evaluation_triggers")
    .insert({ ...validation.data, created_by: auth.user.id })
    .select(`*, course:courses(id, title), template:evaluation_templates(id, name, level)`)
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A trigger already exists for this course and template" }, { status: 409 });
    }
    console.error("Evaluation triggers POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

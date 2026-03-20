import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createEvaluationTemplateSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level");
  const activeOnly = searchParams.get("active") !== "false";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  let query = service
    .from("evaluation_templates")
    .select("*, creator:users!evaluation_templates_created_by_fkey(id, first_name, last_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (activeOnly) query = query.eq("is_active", true);
  if (level) query = query.eq("level", parseInt(level));

  const { data, count, error } = await query;
  if (error) {
    console.error("Evaluation templates GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ templates: data, total: count, page, totalPages: Math.ceil((count || 0) / limit) });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`eval-template-create-${auth.user.id}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createEvaluationTemplateSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("evaluation_templates")
    .insert({ ...validation.data, created_by: auth.user.id })
    .select()
    .single();

  if (error) {
    console.error("Evaluation templates POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

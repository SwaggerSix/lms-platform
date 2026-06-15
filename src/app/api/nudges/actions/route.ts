import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createNudgeActionSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

// GET: list nudge actions (org library + global seed library).
export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const activeOnly = searchParams.get("active") !== "false";

  const { data: me } = await service.from("users").select("organization_id").eq("id", auth.user.id).single();

  let query = service
    .from("nudge_actions")
    .select("*")
    .order("created_at", { ascending: false });

  // Org-scoped actions plus the global library (organization_id IS NULL).
  if (me?.organization_id) {
    query = query.or(`organization_id.eq.${me.organization_id},organization_id.is.null`);
  } else {
    query = query.is("organization_id", null);
  }
  if (activeOnly) query = query.eq("is_active", true);
  if (category) query = query.eq("category", category);

  const { data, error } = await query.range(0, 4999);
  if (error) {
    console.error("Nudge actions GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ actions: data });
}

// POST: create a nudge action (managers/admins).
export async function POST(request: NextRequest) {
  const auth = await authorize("instructor", "manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`nudge-action-create-${auth.user.id}`, 30, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validation = validateBody(createNudgeActionSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();
  const { data: me } = await service.from("users").select("organization_id").eq("id", auth.user.id).single();

  const { data, error } = await service
    .from("nudge_actions")
    .insert({ ...validation.data, created_by: auth.user.id, organization_id: me?.organization_id ?? null })
    .select()
    .single();

  if (error) {
    console.error("Nudge actions POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

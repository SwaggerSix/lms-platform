import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createFeedbackCycleSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantScope = await getTenantScope(auth.user.id, auth.user.role, request);

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  let query = service
    .from("feedback_cycles")
    .select("*, creator:users!feedback_cycles_created_by_fkey(id, first_name, last_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (tenantScope) {
    query = query.in("created_by", tenantScope.userIds);
  }
  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;

  if (error) {
    console.error("Feedback cycles GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ cycles: data, total: count, page, totalPages: Math.ceil((count || 0) / limit) });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`feedback-cycle-create-${auth.user.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createFeedbackCycleSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("feedback_cycles")
    .insert({ ...validation.data, created_by: auth.user.id })
    .select()
    .single();

  if (error) {
    console.error("Feedback cycles POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

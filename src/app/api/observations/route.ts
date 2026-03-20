import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, createObservationSchema } from "@/lib/validations";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantScope = await getTenantScope(auth.user.id, auth.user.role, request);

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role"); // "observer" | "subject"
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  let query = service
    .from("observations")
    .select(`
      *,
      template:observation_templates(id, name, category, items, passing_score),
      observer:users!observations_observer_id_fkey(id, first_name, last_name, email),
      subject:users!observations_subject_id_fkey(id, first_name, last_name, email),
      course:courses(id, title)
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (tenantScope) {
    query = query.in("observer_id", tenantScope.userIds);
  }

  // Filter by role relationship to current user
  if (role === "observer") {
    query = query.eq("observer_id", auth.user.id);
  } else if (role === "subject") {
    query = query.eq("subject_id", auth.user.id);
  } else {
    // Admin/manager sees all; others see their own
    if (auth.user.role !== "admin" && auth.user.role !== "manager") {
      query = query.or(`observer_id.eq.${auth.user.id},subject_id.eq.${auth.user.id}`);
    }
  }

  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;

  if (error) {
    console.error("Observations GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    observations: data,
    total: count,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`obs-create-${auth.user.id}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(createObservationSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Verify template exists
  const { data: template } = await service
    .from("observation_templates")
    .select("id")
    .eq("id", validation.data.template_id)
    .eq("is_active", true)
    .single();

  if (!template) {
    return NextResponse.json({ error: "Template not found or inactive" }, { status: 400 });
  }

  // Verify subject exists
  const { data: subject } = await service
    .from("users")
    .select("id")
    .eq("id", validation.data.subject_id)
    .single();

  if (!subject) {
    return NextResponse.json({ error: "Subject user not found" }, { status: 400 });
  }

  const { data, error } = await service
    .from("observations")
    .insert({
      ...validation.data,
      observer_id: auth.user.id,
    })
    .select(`
      *,
      template:observation_templates(id, name),
      subject:users!observations_subject_id_fkey(id, first_name, last_name)
    `)
    .single();

  if (error) {
    console.error("Observation POST error:", error.message);
    return NextResponse.json({ error: "Failed to create observation" }, { status: 500 });
  }

  return NextResponse.json({ observation: data }, { status: 201 });
}

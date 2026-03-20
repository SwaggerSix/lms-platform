import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, createTenantSchema } from "@/lib/validations";

// GET /api/tenants - List tenants the current user belongs to
export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  // Admins see all tenants; others see only their memberships
  if (auth.user.role === "admin") {
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    let query = service
      .from("tenants")
      .select("*, owner:users!tenants_owner_id_fkey(id, first_name, last_name, email)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (search) {
      const s = search.replace(/[%_\\'"()]/g, "");
      query = query.or(`name.ilike.%${s}%,slug.ilike.%${s}%`);
    }

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: "Failed to fetch tenants" }, { status: 500 });

    return NextResponse.json({ tenants: data, total: count, page, totalPages: Math.ceil((count || 0) / limit) });
  }

  // Non-admin: list tenants user is a member of
  const { data: memberships, error } = await service
    .from("tenant_memberships")
    .select("role, tenant:tenants(*)")
    .eq("user_id", auth.user.id)
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: "Failed to fetch tenants" }, { status: 500 });

  const tenants = (memberships || []).map((m: any) => ({ ...m.tenant, membership_role: m.role }));
  return NextResponse.json({ tenants, total: tenants.length, page, totalPages: 1 });
}

// POST /api/tenants - Create a new tenant
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`tenant-create-${auth.user.id}`, 5, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(createTenantSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Check slug uniqueness
  const { data: existing } = await service
    .from("tenants")
    .select("id")
    .eq("slug", validation.data.slug)
    .single();
  if (existing) return NextResponse.json({ error: "Slug already taken" }, { status: 409 });

  // Create tenant
  const { data: tenant, error } = await service
    .from("tenants")
    .insert({
      ...validation.data,
      owner_id: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Create tenant error:", error.message);
    return NextResponse.json({ error: "Failed to create tenant" }, { status: 500 });
  }

  // Add creator as owner membership
  await service.from("tenant_memberships").insert({
    tenant_id: tenant.id,
    user_id: auth.user.id,
    role: "owner",
  });

  return NextResponse.json({ tenant }, { status: 201 });
}

import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, updateTenantSchema } from "@/lib/validations";

async function verifyTenantAccess(userId: string, tenantId: string, requiredRoles?: string[]) {
  const service = createServiceClient();
  const { data: membership } = await service
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .single();

  if (!membership) return null;
  if (requiredRoles && !requiredRoles.includes(membership.role)) return null;
  return membership;
}

// GET /api/tenants/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();

  // Admin or tenant member can view
  if (auth.user.role !== "admin") {
    const access = await verifyTenantAccess(auth.user.id, id);
    if (!access) return NextResponse.json({ error: "Not a member of this tenant" }, { status: 403 });
  }

  const { data: tenant, error } = await service
    .from("tenants")
    .select("*, owner:users!tenants_owner_id_fkey(id, first_name, last_name, email)")
    .eq("id", id)
    .single();

  if (error || !tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Get counts
  const [{ count: memberCount }, { count: courseCount }] = await Promise.all([
    service.from("tenant_memberships").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    service.from("tenant_courses").select("id", { count: "exact", head: true }).eq("tenant_id", id),
  ]);

  return NextResponse.json({
    tenant: { ...tenant, member_count: memberCount || 0, course_count: courseCount || 0 },
  });
}

// PUT /api/tenants/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Only admin or tenant owner/admin can update
  if (auth.user.role !== "admin") {
    const access = await verifyTenantAccess(auth.user.id, id, ["owner", "admin"]);
    if (!access) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const validation = validateBody(updateTenantSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();
  const { data: tenant, error } = await service
    .from("tenants")
    .update(validation.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Slug or domain already taken" }, { status: 409 });
    return NextResponse.json({ error: "Failed to update tenant" }, { status: 500 });
  }

  return NextResponse.json({ tenant });
}

// DELETE /api/tenants/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { error } = await service.from("tenants").delete().eq("id", id);

  if (error) return NextResponse.json({ error: "Failed to delete tenant" }, { status: 500 });

  return NextResponse.json({ success: true });
}

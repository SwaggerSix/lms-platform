import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, addTenantMemberSchema } from "@/lib/validations";
import { checkTenantLimits } from "@/lib/tenants/tenant-context";

async function verifyTenantAdmin(userId: string, tenantId: string, platformRole: string) {
  if (platformRole === "admin") return true;
  const service = createServiceClient();
  const { data } = await service
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .single();
  return data && ["owner", "admin"].includes(data.role);
}

// GET /api/tenants/[id]/members
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();

  // Verify membership
  if (auth.user.role !== "admin") {
    const { data: membership } = await service
      .from("tenant_memberships")
      .select("id")
      .eq("tenant_id", id)
      .eq("user_id", auth.user.id)
      .single();
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data, error } = await service
    .from("tenant_memberships")
    .select("id, role, joined_at, user:users(id, first_name, last_name, email, role)")
    .eq("tenant_id", id)
    .order("joined_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });

  return NextResponse.json({ members: data });
}

// POST /api/tenants/[id]/members - Add a member
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const isAdmin = await verifyTenantAdmin(auth.user.id, id, auth.user.role);
  if (!isAdmin) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

  const rl = await rateLimit(`tenant-member-add-${auth.user.id}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(addTenantMemberSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  // Check limits
  const limits = await checkTenantLimits(id, "users");
  if (!limits.allowed) {
    return NextResponse.json(
      { error: `User limit reached (${limits.current}/${limits.max}). Upgrade your plan.` },
      { status: 403 }
    );
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("tenant_memberships")
    .insert({
      tenant_id: id,
      user_id: validation.data.user_id,
      role: validation.data.role,
    })
    .select("id, role, joined_at, user:users(id, first_name, last_name, email)")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    if (error.code === "23503") return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }

  return NextResponse.json({ member: data }, { status: 201 });
}

// DELETE /api/tenants/[id]/members - Remove a member
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const isAdmin = await verifyTenantAdmin(auth.user.id, id, auth.user.role);
  if (!isAdmin) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  const service = createServiceClient();

  // Prevent removing the last owner
  const { data: membership } = await service
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", id)
    .eq("user_id", userId)
    .single();

  if (membership?.role === "owner") {
    const { count } = await service
      .from("tenant_memberships")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", id)
      .eq("role", "owner");
    if ((count || 0) <= 1) {
      return NextResponse.json({ error: "Cannot remove the last owner" }, { status: 400 });
    }
  }

  const { error } = await service
    .from("tenant_memberships")
    .delete()
    .eq("tenant_id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });

  return NextResponse.json({ success: true });
}

import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, tenantInviteSchema } from "@/lib/validations";
import { generateInviteToken, checkTenantLimits } from "@/lib/tenants/tenant-context";

// POST /api/tenants/[id]/invite - Send an invitation
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Verify tenant admin
  if (auth.user.role !== "admin") {
    const service = createServiceClient();
    const { data: membership } = await service
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", id)
      .eq("user_id", auth.user.id)
      .single();
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
  }

  const rl = await rateLimit(`tenant-invite-${auth.user.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(tenantInviteSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  // Check user limits
  const limits = await checkTenantLimits(id, "users");
  if (!limits.allowed) {
    return NextResponse.json(
      { error: `User limit reached (${limits.current}/${limits.max}). Upgrade your plan.` },
      { status: 403 }
    );
  }

  const service = createServiceClient();

  // Check for existing pending invitation
  const { data: existingInvite } = await service
    .from("tenant_invitations")
    .select("id")
    .eq("tenant_id", id)
    .eq("email", validation.data.email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (existingInvite) {
    return NextResponse.json({ error: "A pending invitation already exists for this email" }, { status: 409 });
  }

  // Check if already a member
  const { data: existingUser } = await service
    .from("users")
    .select("id")
    .eq("email", validation.data.email)
    .single();

  if (existingUser) {
    const { data: existingMembership } = await service
      .from("tenant_memberships")
      .select("id")
      .eq("tenant_id", id)
      .eq("user_id", existingUser.id)
      .single();
    if (existingMembership) {
      return NextResponse.json({ error: "User is already a member of this tenant" }, { status: 409 });
    }
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const { data: invitation, error } = await service
    .from("tenant_invitations")
    .insert({
      tenant_id: id,
      email: validation.data.email,
      role: validation.data.role,
      token,
      expires_at: expiresAt.toISOString(),
      invited_by: auth.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      expires_at: invitation.expires_at,
    },
  }, { status: 201 });
}

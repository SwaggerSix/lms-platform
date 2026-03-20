import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, acceptInviteSchema } from "@/lib/validations";

// POST /api/tenants/invite/accept - Accept an invitation
export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const validation = validateBody(acceptInviteSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Find the invitation
  const { data: invitation, error: invErr } = await service
    .from("tenant_invitations")
    .select("*")
    .eq("token", validation.data.token)
    .is("accepted_at", null)
    .single();

  if (invErr || !invitation) {
    return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
  }

  // Check expiration
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }

  // Verify email matches (get user email from users table)
  const { data: userRecord } = await service
    .from("users")
    .select("email")
    .eq("id", auth.user.id)
    .single();

  if (userRecord && userRecord.email !== invitation.email) {
    return NextResponse.json(
      { error: "This invitation was sent to a different email address" },
      { status: 403 }
    );
  }

  // Check if already a member
  const { data: existingMembership } = await service
    .from("tenant_memberships")
    .select("id")
    .eq("tenant_id", invitation.tenant_id)
    .eq("user_id", auth.user.id)
    .single();

  if (existingMembership) {
    // Mark invitation as accepted anyway
    await service
      .from("tenant_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);
    return NextResponse.json({ error: "Already a member of this tenant" }, { status: 409 });
  }

  // Add membership and mark accepted
  const [{ error: memberErr }, { error: updateErr }] = await Promise.all([
    service.from("tenant_memberships").insert({
      tenant_id: invitation.tenant_id,
      user_id: auth.user.id,
      role: invitation.role || "member",
    }),
    service
      .from("tenant_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id),
  ]);

  if (memberErr) {
    return NextResponse.json({ error: "Failed to join tenant" }, { status: 500 });
  }

  // Get tenant info
  const { data: tenant } = await service
    .from("tenants")
    .select("id, name, slug")
    .eq("id", invitation.tenant_id)
    .single();

  return NextResponse.json({
    success: true,
    tenant,
    role: invitation.role,
  });
}

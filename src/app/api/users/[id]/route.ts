import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { canAssignRole, isSuperAdmin } from "@/lib/auth/roles";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { processRulesForUser } from "@/lib/automation/rules-engine";
import { EXTERNAL_SOURCE, PORTAL_OWNED_USER_FIELDS } from "@/lib/integrations/partner-portal/sync";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const service = createServiceClient();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { id } = await params;

  // Guard the Super Admin (gC/GGS) role: only Super Admins may modify a Super
  // Admin account or promote someone into the role.
  if (!isSuperAdmin(auth.user.role)) {
    const { data: target } = await service
      .from("users")
      .select("role")
      .eq("id", id)
      .single();
    if (target && isSuperAdmin(target.role)) {
      return NextResponse.json({ error: "You are not allowed to modify this user" }, { status: 403 });
    }
    if (typeof body?.role === "string" && !canAssignRole(auth.user.role, body.role)) {
      return NextResponse.json({ error: "You are not allowed to assign that role" }, { status: 403 });
    }
  }

  // Mass assignment fix: whitelist allowed fields
  let allowedFields = ["first_name", "last_name", "email", "job_title", "role", "status", "organization_id", "manager_id", "preferences", "avatar_url"];

  // For subcontractors synced from the partner portal, the portal owns the
  // identity/content fields (name, email, bio, avatar). Admins can still
  // manage LMS-local concerns — role, status, org, manager — but edits to
  // portal-owned fields are dropped so the next sync isn't clobbered.
  const { data: target } = await service
    .from("users")
    .select("external_source")
    .eq("id", id)
    .single();

  if (target?.external_source === EXTERNAL_SOURCE) {
    allowedFields = allowedFields.filter(
      (f) => !(PORTAL_OWNED_USER_FIELDS as readonly string[]).includes(f)
    );
  }

  const sanitized = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.includes(key))
  );

  const { data, error } = await service
    .from("users")
    .update(sanitized)
    .eq("id", id)
    .select("id, first_name, last_name, email, role, status, job_title, avatar_url, organization_id")
    .single();

  if (error) {
    console.error("Users API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "user",
    entityId: id,
    newValues: sanitized,
  });

  // Fire-and-forget: process automation rules for role/org changes
  if (sanitized.role) {
    processRulesForUser(id, "role_changed").catch((err) =>
      console.error("Automation rule processing (role_changed) failed:", err)
    );
  }
  if (sanitized.organization_id) {
    processRulesForUser(id, "org_changed").catch((err) =>
      console.error("Automation rule processing (org_changed) failed:", err)
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { id } = await params;

  if (id === auth.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await service
    .from("users")
    .select("id, email, auth_id, role")
    .eq("id", id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.error("Users API error:", fetchError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Only Super Admins (gC/GGS) may delete a Super Admin account.
  if (isSuperAdmin(existing.role) && !isSuperAdmin(auth.user.role)) {
    return NextResponse.json({ error: "You are not allowed to delete this user" }, { status: 403 });
  }

  const { error: deleteError } = await service.from("users").delete().eq("id", id);

  if (deleteError) {
    console.error("Users API error:", deleteError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (existing.auth_id) {
    await service.auth.admin.deleteUser(existing.auth_id).catch((err) => {
      console.error("Failed to delete auth user:", err);
    });
  }

  logAudit({
    userId: auth.user.id,
    action: "deleted",
    entityType: "user",
    entityId: id,
    oldValues: { email: existing.email },
  });

  return NextResponse.json({ message: "User deleted successfully" });
}

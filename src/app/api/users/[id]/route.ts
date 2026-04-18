import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { processRulesForUser } from "@/lib/automation/rules-engine";

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

  // Mass assignment fix: whitelist allowed fields
  const allowedFields = ["first_name", "last_name", "email", "job_title", "role", "status", "organization_id", "manager_id", "preferences", "avatar_url"];
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
    .select("id, email, auth_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    if (fetchError?.code === "PGRST116" || !existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.error("Users API error:", fetchError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

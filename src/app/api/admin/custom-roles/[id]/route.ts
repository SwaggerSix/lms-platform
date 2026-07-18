import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { CUSTOM_ROLE_BASE_ROLES, constrainToBase } from "@/lib/auth/permissions";

type Ctx = { params: Promise<{ id: string }> };

/** Load a custom role and enforce that the caller's org may act on it. */
async function loadScoped(
  service: ReturnType<typeof createServiceClient>,
  id: string,
  actorOrgId: string | null
) {
  const { data } = await service
    .from("custom_roles")
    .select("id, name, base_role, organization_id, permissions, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { role: null, forbidden: false };
  // Tenant isolation: an org-bound admin may only manage their own org's roles
  // (global roles are managed by platform staff / null-org admins). A null-org
  // admin imposes no restriction.
  if (actorOrgId && data.organization_id && data.organization_id !== actorOrgId) {
    return { role: null, forbidden: true };
  }
  return { role: data, forbidden: false };
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const service = createServiceClient();
  const { id } = await params;
  const { role, forbidden } = await loadScoped(service, id, auth.user.organization_id ?? null);
  if (forbidden) return NextResponse.json({ error: "You are not allowed to modify this role" }, { status: 403 });
  if (!role) return NextResponse.json({ error: "Custom role not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (typeof body?.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body?.description === "string") update.description = body.description;
  if (typeof body?.is_active === "boolean") update.is_active = body.is_active;

  // base_role can be changed; permissions are always re-constrained to whatever
  // the effective base role allows, so an edit can never escalate the grant.
  const nextBaseRole =
    body?.base_role !== undefined ? body.base_role : role.base_role;
  if (body?.base_role !== undefined && !CUSTOM_ROLE_BASE_ROLES.includes(body.base_role)) {
    return NextResponse.json({ error: "Invalid base role" }, { status: 400 });
  }
  if (body?.base_role !== undefined) update.base_role = nextBaseRole;

  if (body?.permissions !== undefined || body?.base_role !== undefined) {
    const requested = Array.isArray(body?.permissions)
      ? body.permissions
      : (role.permissions as string[]) ?? [];
    update.permissions = constrainToBase(nextBaseRole, requested);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await service
    .from("custom_roles")
    .update(update)
    .eq("id", id)
    .select("id, name, description, base_role, organization_id, permissions, is_active, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A role with that name already exists" }, { status: 409 });
    }
    console.error("Custom roles PATCH error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "custom_role",
    entityId: id,
    newValues: update,
  });

  return NextResponse.json({ customRole: data });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { id } = await params;
  const { role, forbidden } = await loadScoped(service, id, auth.user.organization_id ?? null);
  if (forbidden) return NextResponse.json({ error: "You are not allowed to delete this role" }, { status: 403 });
  if (!role) return NextResponse.json({ error: "Custom role not found" }, { status: 404 });

  // Deleting a custom role unassigns it from any users (FK ON DELETE SET NULL),
  // leaving their base `users.role` intact — they revert to base-role defaults.
  const { error } = await service.from("custom_roles").delete().eq("id", id);
  if (error) {
    console.error("Custom roles DELETE error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "deleted",
    entityType: "custom_role",
    entityId: id,
    oldValues: { name: role.name },
  });

  return NextResponse.json({ message: "Custom role deleted" });
}

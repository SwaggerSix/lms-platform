import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import {
  CUSTOM_ROLE_BASE_ROLES,
  constrainToBase,
} from "@/lib/auth/permissions";

/**
 * Custom roles management API. Custom roles are permission overlays on a built-in
 * base role (see src/lib/auth/permissions.ts). Creation/edit is admin-only and
 * tenant-scoped; the granted permission set is always constrained to a subset of
 * the base role's defaults so a custom role can never exceed its base role.
 */

// GET — list custom roles visible to the caller (their org's roles + globals).
export async function GET() {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  let query = service
    .from("custom_roles")
    .select("id, name, description, base_role, organization_id, permissions, is_active, created_at, updated_at")
    .order("name", { ascending: true });

  // Tenant scope: an org-bound admin sees their org's roles plus global (null
  // org) roles. A null-org admin (single-tenant today) sees everything.
  if (auth.user.organization_id) {
    query = query.or(`organization_id.eq.${auth.user.organization_id},organization_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Custom roles GET error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }
  return NextResponse.json({ customRoles: data ?? [] });
}

// POST — create a custom role.
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const baseRole = body?.base_role;
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!CUSTOM_ROLE_BASE_ROLES.includes(baseRole)) {
    return NextResponse.json({ error: "Invalid base role" }, { status: 400 });
  }

  const requested = Array.isArray(body?.permissions) ? body.permissions : [];
  const permissions = constrainToBase(baseRole, requested);

  const service = createServiceClient();
  const { data, error } = await service
    .from("custom_roles")
    .insert({
      name,
      description: typeof body?.description === "string" ? body.description : null,
      base_role: baseRole,
      // Scope to the creator's org; a null-org (super/single-tenant) admin
      // creates a global role.
      organization_id: auth.user.organization_id ?? null,
      permissions,
      created_by: auth.user.id,
    })
    .select("id, name, description, base_role, organization_id, permissions, is_active, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A role with that name already exists" }, { status: 409 });
    }
    console.error("Custom roles POST error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "created",
    entityType: "custom_role",
    entityId: data.id,
    newValues: { name, base_role: baseRole, permissions },
  });

  return NextResponse.json({ customRole: data }, { status: 201 });
}

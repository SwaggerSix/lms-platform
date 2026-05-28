import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  FEATURE_CATALOG,
  FEATURE_KEY_SET,
  defaultFeatureMap,
  normalizeFeatures,
} from "@/lib/features/catalog";
import { logAudit } from "@/lib/audit";

// Body: { features: { [key]: boolean } }. Keys must be known catalog features.
const updateFeaturesSchema = z.object({
  features: z.record(z.string(), z.boolean()).refine(
    (obj) => Object.keys(obj).every((k) => FEATURE_KEY_SET.has(k)),
    { message: "Unknown feature key" }
  ),
});

async function verifyTenantAccess(
  userId: string,
  tenantId: string,
  requiredRoles?: string[]
) {
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

// GET /api/tenants/[id]/features
// Returns the catalog plus the tenant's effective enablement and explicit overrides.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authorize();
  if (!auth.authorized)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (auth.user.role !== "admin" && auth.user.role !== "super_admin") {
    const access = await verifyTenantAccess(auth.user.id, id);
    if (!access)
      return NextResponse.json(
        { error: "Not a member of this tenant" },
        { status: 403 }
      );
  }

  const service = createServiceClient();
  const { data: tenant, error } = await service
    .from("tenants")
    .select("features")
    .eq("id", id)
    .single();

  if (error || !tenant)
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Platform defaults overlaid with the tenant's explicit overrides.
  const overrides = normalizeFeatures(tenant.features);
  const effective = { ...defaultFeatureMap(), ...overrides };

  return NextResponse.json({
    catalog: FEATURE_CATALOG,
    overrides,
    effective,
  });
}

// PATCH /api/tenants/[id]/features
// Body: { features: { [key]: boolean } }. Merges into the tenant's overrides.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authorize();
  if (!auth.authorized)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Platform admins, or the tenant's own owner/admin, may change features.
  if (auth.user.role !== "admin" && auth.user.role !== "super_admin") {
    const access = await verifyTenantAccess(auth.user.id, id, ["owner", "admin"]);
    if (!access)
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateFeaturesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid request body" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { data: existing, error: fetchError } = await service
    .from("tenants")
    .select("features")
    .eq("id", id)
    .single();

  if (fetchError || !existing)
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Merge the incoming toggles onto the tenant's existing overrides.
  const merged = {
    ...normalizeFeatures(existing.features),
    ...parsed.data.features,
  };

  const { data: tenant, error } = await service
    .from("tenants")
    .update({ features: merged })
    .eq("id", id)
    .select("features")
    .single();

  if (error)
    return NextResponse.json(
      { error: "Failed to update features" },
      { status: 500 }
    );

  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "tenant_features",
    entityId: id,
    newValues: parsed.data.features,
  });

  const overrides = normalizeFeatures(tenant.features);
  return NextResponse.json({
    overrides,
    effective: { ...defaultFeatureMap(), ...overrides },
  });
}

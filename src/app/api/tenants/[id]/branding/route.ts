import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, updateTenantBrandingSchema } from "@/lib/validations";
import { getTenantBranding } from "@/lib/tenants/tenant-context";

// GET /api/tenants/[id]/branding
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const branding = await getTenantBranding(id);
  if (!branding) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  return NextResponse.json({ branding });
}

// PUT /api/tenants/[id]/branding
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await request.json();
  const validation = validateBody(updateTenantBrandingSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const { branding: brandingObj, ...directFields } = validation.data;

  const updatePayload: Record<string, unknown> = { ...directFields };
  if (brandingObj) {
    updatePayload.branding = brandingObj;
  }

  const service = createServiceClient();
  const { data: tenant, error } = await service
    .from("tenants")
    .update(updatePayload)
    .eq("id", id)
    .select("name, slug, logo_url, favicon_url, primary_color, secondary_color, branding")
    .single();

  if (error) return NextResponse.json({ error: "Failed to update branding" }, { status: 500 });

  return NextResponse.json({ branding: tenant });
}

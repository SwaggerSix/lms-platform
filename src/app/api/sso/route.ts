import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createSSOProviderSchema, updateSSOProviderSchema } from "@/lib/validations";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { data, error } = await service
    .from("sso_providers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("SSO API GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Never expose the SCIM token hash to the client
  const sanitized = (data ?? []).map(({ scim_token_hash, ...rest }) => ({
    ...rest,
    has_scim_token: !!scim_token_hash,
  }));

  return NextResponse.json(sanitized);
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createSSOProviderSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Check domain uniqueness
  const { data: existing } = await service
    .from("sso_providers")
    .select("id")
    .eq("domain", validation.data.domain)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `An SSO provider already exists for domain "${validation.data.domain}"` },
      { status: 409 }
    );
  }

  const allowedFields = [
    "name", "provider_type", "entity_id", "metadata_url",
    "domain", "auto_provision_users", "default_role", "attribute_mapping",
  ];
  const sanitized = Object.fromEntries(
    Object.entries(validation.data).filter(([key]) => allowedFields.includes(key))
  );

  const { data, error } = await service
    .from("sso_providers")
    .insert(sanitized)
    .select()
    .single();

  if (error) {
    console.error("SSO API POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(updateSSOProviderSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { id, ...updates } = validation.data;

  // If domain is being changed, check uniqueness
  if (updates.domain) {
    const service = createServiceClient();
    const { data: existing } = await service
      .from("sso_providers")
      .select("id")
      .eq("domain", updates.domain)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `An SSO provider already exists for domain "${updates.domain}"` },
        { status: 409 }
      );
    }
  }

  const allowedFields = [
    "name", "provider_type", "entity_id", "metadata_url",
    "domain", "auto_provision_users", "default_role", "attribute_mapping",
    "is_active", "scim_enabled",
  ];
  const sanitizedUpdates = Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowedFields.includes(key))
  );

  const service = createServiceClient();
  const { data, error } = await service
    .from("sso_providers")
    .update({ ...sanitizedUpdates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("SSO API PATCH error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Provider id is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("sso_providers")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("SSO API DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ message: "SSO provider deleted" });
}

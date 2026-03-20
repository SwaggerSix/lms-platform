import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { encryptSecret } from "@/lib/integrations/video-conferencing";

/**
 * GET /api/integrations/video
 * List configured video integrations (admin only)
 */
export async function GET() {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("vc_integrations")
    .select("id, provider, is_active, client_id, settings, token_expires_at, created_at, updated_at")
    .order("provider");

  if (error) {
    console.error("Video integrations GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Never return secrets - only indicate whether they are set
  const integrations = (data ?? []).map((row: any) => ({
    id: row.id,
    provider: row.provider,
    is_active: row.is_active,
    has_client_id: !!row.client_id,
    has_credentials: !!row.client_id,
    settings: row.settings || {},
    token_expires_at: row.token_expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return NextResponse.json({ integrations });
}

/**
 * POST /api/integrations/video
 * Configure a video integration (admin only)
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { provider, client_id, client_secret, settings } = body;

  if (!provider || !["zoom", "teams", "google_meet"].includes(provider)) {
    return NextResponse.json(
      { error: "Valid provider is required (zoom, teams, google_meet)" },
      { status: 400 }
    );
  }

  if (!client_id || !client_secret) {
    return NextResponse.json(
      { error: "client_id and client_secret are required" },
      { status: 400 }
    );
  }

  const encryptedSecret = encryptSecret(client_secret);

  const service = createServiceClient();

  // Upsert the integration
  const { data, error } = await service
    .from("vc_integrations")
    .upsert(
      {
        provider,
        client_id,
        client_secret_encrypted: encryptedSecret,
        is_active: true,
        settings: settings || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider" }
    )
    .select("id, provider, is_active, client_id, settings, created_at, updated_at")
    .single();

  if (error) {
    console.error("Video integrations POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    integration: {
      id: data.id,
      provider: data.provider,
      is_active: data.is_active,
      has_client_id: !!data.client_id,
      has_credentials: true,
      settings: data.settings,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  }, { status: 201 });
}

/**
 * PATCH /api/integrations/video
 * Update integration settings
 */
export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { provider, settings, is_active, client_id, client_secret } = body;

  if (!provider) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 });
  }

  const service = createServiceClient();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (settings !== undefined) updates.settings = settings;
  if (is_active !== undefined) updates.is_active = is_active;
  if (client_id !== undefined) updates.client_id = client_id;
  if (client_secret) {
    updates.client_secret_encrypted = encryptSecret(client_secret);
  }

  const { data, error } = await service
    .from("vc_integrations")
    .update(updates)
    .eq("provider", provider)
    .select("id, provider, is_active, client_id, settings, created_at, updated_at")
    .single();

  if (error) {
    console.error("Video integrations PATCH error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  return NextResponse.json({
    integration: {
      id: data.id,
      provider: data.provider,
      is_active: data.is_active,
      has_client_id: !!data.client_id,
      has_credentials: true,
      settings: data.settings,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  });
}

/**
 * DELETE /api/integrations/video
 * Remove an integration
 */
export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  if (!provider) {
    return NextResponse.json({ error: "provider query param is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("vc_integrations")
    .delete()
    .eq("provider", provider);

  if (error) {
    console.error("Video integrations DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `${provider} integration removed` });
}

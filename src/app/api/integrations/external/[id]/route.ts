import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, updateExternalIntegrationSchema } from "@/lib/validations";
import { jsonNoStore } from "@/lib/api/no-store";
import { jsonCached } from "@/lib/api/cached";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data, error } = await service
    .from("external_integrations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  // Mask sensitive fields
  const cfg = data.config as unknown as {
    api_key_encrypted?: string;
    client_secret_encrypted?: string;
    access_token?: string;
  } | null;
  const sanitized = {
    ...data,
    config: {
      ...data.config,
      api_key_encrypted: cfg?.api_key_encrypted ? "••••••••" : undefined,
      client_secret_encrypted: cfg?.client_secret_encrypted ? "••••••••" : undefined,
      access_token: cfg?.access_token ? "••••••••" : undefined,
    },
  };

  return jsonCached({ integration: sanitized });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin");
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const validation = validateBody(updateExternalIntegrationSchema, body);
  if (!validation.success) return jsonNoStore({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // If config is being updated, merge with existing config to preserve encrypted fields
  if (validation.data.config) {
    const { data: existing } = await service
      .from("external_integrations")
      .select("config")
      .eq("id", id)
      .single();

    if (existing) {
      validation.data.config = { ...(existing.config as unknown as Record<string, unknown>), ...validation.data.config };
    }
  }

  const { data, error } = await service
    .from("external_integrations")
    .update(validation.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("External integration PUT error:", error.message);
    return jsonNoStore({ error: "Failed to update integration" }, { status: 500 });
  }

  return jsonNoStore({ integration: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin");
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { error } = await service
    .from("external_integrations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("External integration DELETE error:", error.message);
    return jsonNoStore({ error: "Failed to delete integration" }, { status: 500 });
  }

  return jsonNoStore({ success: true });
}

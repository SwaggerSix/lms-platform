import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, updateExternalIntegrationSchema } from "@/lib/validations";
import {
  encryptConfigSecrets,
  maskConfigSecrets,
  stripMaskedSecrets,
} from "@/lib/security/secret-crypto";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("super_admin");
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
  const sanitized = {
    ...data,
    config: maskConfigSecrets(data.config as Record<string, unknown>),
  };

  return NextResponse.json({ integration: sanitized });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const validation = validateBody(updateExternalIntegrationSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // If config is being updated, merge with existing config to preserve encrypted fields
  if (validation.data.config) {
    // Drop round-tripped "••••••••" placeholders so they never overwrite the
    // stored secrets, then encrypt any newly supplied secret values.
    validation.data.config = encryptConfigSecrets(stripMaskedSecrets(validation.data.config));

    const { data: existing } = await service
      .from("external_integrations")
      .select("config")
      .eq("id", id)
      .single();

    if (existing) {
      validation.data.config = { ...(existing.config as any), ...validation.data.config };
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
    return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
  }

  return NextResponse.json({
    integration: { ...data, config: maskConfigSecrets(data.config as Record<string, unknown>) },
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { error } = await service
    .from("external_integrations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("External integration DELETE error:", error.message);
    return NextResponse.json({ error: "Failed to delete integration" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

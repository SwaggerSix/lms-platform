import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, lrsConfigUpdateSchema } from "@/lib/validations";
import { LRSClient } from "@/lib/xapi/lrs-client";

/**
 * PUT /api/admin/lrs/[id]
 * Update an LRS configuration.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = await request.json();
  const validation = validateBody(lrsConfigUpdateSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const data = validation.data;
  const service = createServiceClient();

  // Build update payload, only including provided fields
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.endpoint_url !== undefined) update.endpoint_url = data.endpoint_url;
  if (data.auth_type !== undefined) update.auth_type = data.auth_type;
  if (data.username !== undefined) update.username = data.username;
  if (data.password !== undefined) update.password_encrypted = data.password;
  if (data.token !== undefined) update.token_encrypted = data.token;
  if (data.is_active !== undefined) update.is_active = data.is_active;
  if (data.sync_direction !== undefined) update.sync_direction = data.sync_direction;

  const { data: config, error } = await service
    .from("lrs_configurations")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update LRS configuration:", error.message);
    return NextResponse.json({ error: "Failed to update LRS configuration" }, { status: 500 });
  }

  if (!config) {
    return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
  }

  return NextResponse.json({ configuration: config });
}

/**
 * DELETE /api/admin/lrs/[id]
 * Delete an LRS configuration.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const service = createServiceClient();

  const { error } = await service
    .from("lrs_configurations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete LRS configuration:", error.message);
    return NextResponse.json({ error: "Failed to delete LRS configuration" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

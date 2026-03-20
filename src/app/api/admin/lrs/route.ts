import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, lrsConfigSchema } from "@/lib/validations";
import { encryptSecret } from "@/lib/integrations/video-conferencing";

/**
 * GET /api/admin/lrs
 * List all LRS configurations.
 */
export async function GET() {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("lrs_configurations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("LRS configurations query error:", error.message);
    return NextResponse.json({ error: "Failed to fetch LRS configurations" }, { status: 500 });
  }

  // Sanitize sensitive fields
  const sanitized = (data || []).map(({ password_encrypted, token_encrypted, ...rest }: any) => ({
    ...rest,
    has_password: !!password_encrypted,
    has_token: !!token_encrypted,
  }));

  return NextResponse.json({ configurations: sanitized });
}

/**
 * POST /api/admin/lrs
 * Create a new LRS configuration.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const validation = validateBody(lrsConfigSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const data = validation.data;
  const service = createServiceClient();

  const { data: config, error } = await service
    .from("lrs_configurations")
    .insert({
      name: data.name,
      endpoint_url: data.endpoint_url,
      auth_type: data.auth_type,
      username: data.username || null,
      password_encrypted: data.password ? encryptSecret(data.password) : null,
      token_encrypted: data.token ? encryptSecret(data.token) : null,
      is_active: data.is_active ?? true,
      sync_direction: data.sync_direction || "push",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create LRS configuration:", error.message);
    return NextResponse.json({ error: "Failed to create LRS configuration" }, { status: 500 });
  }

  return NextResponse.json({ configuration: config }, { status: 201 });
}

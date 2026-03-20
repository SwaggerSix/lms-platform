import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, createExternalIntegrationSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const provider = searchParams.get("provider");
  const active = searchParams.get("active");

  let query = service
    .from("external_integrations")
    .select("*")
    .order("created_at", { ascending: false });

  if (type) query = query.eq("type", type);
  if (provider) query = query.eq("provider", provider);
  if (active === "true") query = query.eq("is_active", true);
  if (active === "false") query = query.eq("is_active", false);

  const { data, error } = await query;

  if (error) {
    console.error("External integrations GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Strip sensitive config fields from response
  const sanitized = (data || []).map((item: any) => ({
    ...item,
    config: {
      ...item.config,
      api_key_encrypted: item.config?.api_key_encrypted ? "••••••••" : undefined,
      client_secret_encrypted: item.config?.client_secret_encrypted ? "••••••••" : undefined,
      access_token: item.config?.access_token ? "••••••••" : undefined,
    },
  }));

  return NextResponse.json({ integrations: sanitized });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`integrations-create-${auth.user.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(createExternalIntegrationSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("external_integrations")
    .insert({
      ...validation.data,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("External integrations POST error:", error.message);
    return NextResponse.json({ error: "Failed to create integration" }, { status: 500 });
  }

  return NextResponse.json({ integration: data }, { status: 201 });
}

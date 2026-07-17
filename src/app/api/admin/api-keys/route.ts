import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { generateApiKey } from "@/lib/api-keys";

/**
 * GET /api/admin/api-keys — list the organization's keys (never the secret).
 */
export async function GET() {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  let query = service
    .from("api_keys")
    .select("id, name, key_prefix, last_four, status, created_at, last_used_at")
    .order("created_at", { ascending: false });
  if (auth.user.organization_id) {
    query = query.eq("organization_id", auth.user.organization_id);
  }
  const { data, error } = await query;

  if (error) {
    console.error("API keys error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }
  return NextResponse.json({ api_keys: data ?? [] });
}

/**
 * POST /api/admin/api-keys — generate a new key. The plaintext secret is
 * returned exactly once; only its hash is stored.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "API Key";

  const { secret, hash, prefix, lastFour } = generateApiKey();
  const service = createServiceClient();

  const { data, error } = await service
    .from("api_keys")
    .insert({
      organization_id: auth.user.organization_id ?? null,
      name,
      key_hash: hash,
      key_prefix: prefix,
      last_four: lastFour,
      created_by: auth.user.id,
    })
    .select("id, name, key_prefix, last_four, status, created_at, last_used_at")
    .single();

  if (error) {
    console.error("API keys error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "created",
    entityType: "api_key",
    entityId: data.id,
    newValues: { name },
  });

  // `secret` is included ONLY in this create response and never stored.
  return NextResponse.json({ ...data, secret }, { status: 201 });
}

/**
 * DELETE /api/admin/api-keys?id=... — revoke a key.
 */
export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "API key id is required" }, { status: 400 });
  }

  const service = createServiceClient();
  let query = service
    .from("api_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (auth.user.organization_id) {
    query = query.eq("organization_id", auth.user.organization_id);
  }
  const { data, error } = await query.select("id").maybeSingle();

  if (error) {
    console.error("API keys error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  logAudit({
    userId: auth.user.id,
    action: "revoked",
    entityType: "api_key",
    entityId: id,
  });

  return NextResponse.json({ success: true, revoked_id: id });
}

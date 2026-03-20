import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  // Feature flags are readable by any authenticated user (needed for sidebar)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  const service = createServiceClient();

  if (key) {
    const { data, error } = await service
      .from("platform_settings")
      .select("key, value")
      .eq("key", key)
      .single();

    if (error || !data) {
      return NextResponse.json({ key, value: {} });
    }
    return NextResponse.json(data);
  }

  // Return all settings (admin only)
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await service
    .from("platform_settings")
    .select("key, value")
    .order("key");

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
  }

  const { data, error } = await service
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })
    .select()
    .single();

  if (error) {
    console.error("Settings API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "setting",
    entityId: key,
    newValues: { key, value },
  });

  return NextResponse.json(data);
}

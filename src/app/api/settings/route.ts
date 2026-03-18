import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
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

  return NextResponse.json(data);
}

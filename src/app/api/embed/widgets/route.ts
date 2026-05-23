import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createWidgetSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import crypto from "crypto";
import { jsonNoStore } from "@/lib/api/no-store";
import { jsonCached } from "@/lib/api/cached";

export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();

  const { data, error } = await service
    .from("embed_widgets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Embed widgets GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return jsonCached({ widgets: data });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`widget-create-${auth.user.id}`, 10, 60000);
  if (!rl.success) return jsonNoStore({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createWidgetSchema, body);
  if (!validation.success) {
    return jsonNoStore({ error: validation.error }, { status: 400 });
  }

  const embedToken = crypto.randomBytes(24).toString("base64url");

  const service = createServiceClient();
  const { data, error } = await service
    .from("embed_widgets")
    .insert({
      ...validation.data,
      embed_token: embedToken,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Embed widgets POST error:", error.message);
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
  }

  return jsonNoStore(data, { status: 201 });
}

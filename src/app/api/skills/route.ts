import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createSkillSchema } from "@/lib/validations";
import { getTenantScope } from "@/lib/tenants/tenant-queries";
import { jsonCached } from "@/lib/api/cached";
import { jsonNoStore } from "@/lib/api/no-store";
import { isManagerOrAbove } from "@/lib/auth/roles";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("users").select("id, role").eq("auth_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const tenantScope = await getTenantScope(profile.id, profile.role, request);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  // Semantic shift: super_admin now also passes (intended behavior).
  if (userId && userId !== profile.id && !isManagerOrAbove(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (userId) {
    const { data, error } = await service
      .from("user_skills")
      .select("*, skill:skills(*)")
      .eq("user_id", userId)
      .order("assessed_at", { ascending: false });

    if (error) {
    console.error("Skills API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
    return jsonCached(data);
  }

  const { data, error } = await service
    .from("skills")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Skills API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return jsonCached(data);
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  const service = createServiceClient();
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();
  const validation = validateBody(createSkillSchema, body);
  if (!validation.success) {
    return jsonNoStore({ error: validation.error }, { status: 400 });
  }

  const { data, error } = await service
    .from("skills")
    .insert(validation.data)
    .select()
    .single();

  if (error) {
    console.error("Skills API error:", error.message);
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
  }
  return jsonNoStore(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  const service = createServiceClient();
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();
  const { id } = body;

  if (!id) return jsonNoStore({ error: "Missing id" }, { status: 400 });

  const allowedFields = ["name", "category", "description"] as const;
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  const { data, error } = await service
    .from("skills")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Skills API error:", error.message);
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
  }
  return jsonNoStore(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  const service = createServiceClient();
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return jsonNoStore({ error: "Missing id" }, { status: 400 });

  const { error } = await service
    .from("skills")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Skills API error:", error.message);
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
  }
  return jsonNoStore({ success: true });
}
